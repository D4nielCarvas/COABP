/**
 * equipment-agent/agent.js
 *
 * Agent standalone para consulta de Equipamentos via Oracle + Firebase.
 *
 * Arquitetura (padrão Command/Listener):
 *   1. Autentica no Firebase com credenciais de serviço (.env)
 *   2. Descobre o tenantId do usuário autenticado
 *   3. Abre um listener (onSnapshot) na coleção `tenants/{tenantId}/sync_requests`
 *      filtrando documentos com status = 'pendente'
 *   4. Despacha cada requisição para o handler correto (padrão Command/Strategy)
 *   5. Atualiza o documento Firestore com o resultado ou erro
 *
 * Ações suportadas:
 *   - BUSCAR_EQUIPAMENTOS  → busca frota por filial / termo de busca
 *   - BUSCAR_OS            → Ordens de Serviço (últimos 12 meses)
 *
 * Para adicionar novas ações: implemente uma função processar<NomeAcao>
 * e registre-a no objeto `handlers` dentro de startAgent().
 *
 * Uso:
 *   node agent.js          → conecta ao Oracle real
 *   node agent.js --mock   → retorna dados fictícios (sem Oracle)
 */

require('dotenv').config()
const oracledb = require('oracledb')
const { initializeApp } = require('firebase/app')
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth')
const {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  serverTimestamp
} = require('firebase/firestore')

// ---------------------------------------------------------------------------
// CONFIGURAÇÃO FIREBASE (pública — sem chave secreta aqui)
// ---------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: 'AIzaSyCNlz1xXT6JOYW6lLCzzjBVtOr3zKa0leM',
  authDomain: 'auditit-ff29c.firebaseapp.com',
  projectId: 'auditit-ff29c',
  storageBucket: 'auditit-ff29c.firebasestorage.app',
  messagingSenderId: '549165711494',
  appId: '1:549165711494:web:c355bd3815fd545c381107'
}

// ---------------------------------------------------------------------------
// ORACLE THICK MODE (Oracle 10g/11g — remova se usar apenas 19c+)
// ---------------------------------------------------------------------------
try {
  oracledb.initOracleClient()
} catch {
  console.warn('Thin mode ativo (Oracle Client nativo nao encontrado).')
}

// ---------------------------------------------------------------------------
// VARIÁVEIS DE AMBIENTE
// ---------------------------------------------------------------------------
const { APP_EMAIL, APP_PASSWORD } = process.env
const isMock = process.argv.includes('--mock')

if (!APP_EMAIL || !APP_PASSWORD) {
  console.error('ERRO: APP_EMAIL e APP_PASSWORD nao configurados no .env')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// ESTADO GLOBAL
// ---------------------------------------------------------------------------
const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

let oracleConnection = null
let agentTenantId = null

// ---------------------------------------------------------------------------
// CONEXÃO ORACLE (com reconexão automática)
// ---------------------------------------------------------------------------
async function connectToOracle() {
  if (isMock) {
    console.log('MODO MOCK: Oracle nao sera conectado.')
    return true
  }

  if (oracleConnection) {
    try {
      await oracleConnection.ping()
      return true
    } catch {
      console.warn('Conexao Oracle expirada. Reconectando...')
      try { await oracleConnection.close() } catch { }
      oracleConnection = null
    }
  }

  try {
    // Credenciais do Oracle ficam no Firestore (nunca no .env do agent)
    const credRef = doc(db, 'tenants', agentTenantId, 'integracoes', 'oracle')
    const credSnap = await getDoc(credRef)

    if (!credSnap.exists()) {
      throw new Error('Credenciais Oracle nao configuradas no aplicativo.')
    }

    const { host, user, password } = credSnap.data()

    if (!host || !user || !password) {
      throw new Error('Credenciais Oracle incompletas no Firestore.')
    }

    oracleConnection = await oracledb.getConnection({
      user,
      password,
      connectString: host
    })

    console.log('Oracle conectado com sucesso.')
    return true
  } catch (err) {
    console.error('Falha ao conectar no Oracle:', err.message)
    return false
  }
}

// ---------------------------------------------------------------------------
// HANDLER: BUSCAR_EQUIPAMENTOS
// Payload esperado: { fazendaId, codIntegracao, searchTerm? }
//
// Complexidade: O(n) — percorre todas as linhas retornadas pelo Oracle
// Segurança: searchTerm sanitizado com replace de aspas simples antes da interpolacao
// ---------------------------------------------------------------------------
async function processarBuscaEquipamentos(requestData, reqRef) {
  const { fazendaId, codIntegracao, searchTerm } = requestData.payload

  if (!codIntegracao) {
    throw new Error("'codIntegracao' (Filial) e obrigatorio.")
  }

  const codAgricola = String(codIntegracao).trim()
  const oracleResults = []

  if (isMock) {
    oracleResults.push(
      { codigo: 'TR-01', frota: 'F-100', placa: 'ABC-1234', descricao: 'TRATOR JOHN DEERE 8320R', _fazendaId: fazendaId },
      { codigo: 'TR-02', frota: 'F-101', placa: 'XYZ-9876', descricao: 'COLHEITADEIRA CASE IH 8250', _fazendaId: fazendaId },
      { codigo: 'IM-01', frota: '', placa: '', descricao: 'PLANTADEIRA DB50', _fazendaId: fazendaId },
      { codigo: 'PV-01', frota: 'P-01', placa: 'DEF-5678', descricao: 'PULVERIZADOR JACTO UNIPORT 3030', _fazendaId: fazendaId }
    )
  } else {
    // Sanitiza searchTerm para prevenir SQL Injection via interpolacao
    const safe = (s) => String(s).toUpperCase().replace(/'/g, "''")
    const whereBusca = searchTerm
      ? `AND (UPPER(EQP.COD_EQUIPAMENTO) LIKE '%${safe(searchTerm)}%'
             OR UPPER(MODVER.DSC_MODELO) LIKE '%${safe(searchTerm)}%')`
      : ''

    const sql = `
      SELECT
        EQP.COD_EMPR,
        EQP.COD_EQUIPAMENTO    AS "codigo",
        EQP.COD_EQUIPAMENTO    AS "frota",
        MODVER.DSC_MODELO      AS "descricao",
        EQP.EQP_ANO_FABRIC     AS "ano",
        EQP.EQP_CHASSI         AS "chassi",
        EQP.EQP_PLACA          AS "placa",
        PROPEQP.DSC_PROP_EQUIP AS "proprietario"
      FROM GATEC_MEC.GA_EQP_EQUIPAMENTO EQP
        LEFT JOIN GATEC_MEC.GA_EQP_MODELO_VERSAO MODVER
          ON EQP.COD_VERSAO = MODVER.COD_VERSAO
          AND EQP.COD_MODELO = MODVER.COD_MODELO
        JOIN GATEC_MEC.GA_TABGR_PROP_EQUIP PROPEQP
          ON PROPEQP.COD_PROP_EQUIP = EQP.COD_PROP_EQUIP
      WHERE EQP.EQP_STATUS = 1
        AND PROPEQP.PROP_EQUIP_TIPO = 'P'
        AND EQP.ID_CLASSE NOT IN (30, 32)
        AND EQP.COD_EMPR = '${codAgricola}'
        ${whereBusca}
    `

    const result = await oracleConnection.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT })
    result.rows.forEach(r => oracleResults.push(r))
  }

  await updateDoc(reqRef, {
    status: 'concluido',
    resultado: oracleResults,
    processadoEm: serverTimestamp()
  })

  console.log(`BUSCAR_EQUIPAMENTOS -> ${oracleResults.length} equipamento(s) encontrado(s).`)
}

// ---------------------------------------------------------------------------
// HANDLER: BUSCAR_OS — Ordens de Servico (ultimos 12 meses)
// Payload esperado: { fazendaId, codIntegracao, options?: { apenasAbertas: boolean } }
//
// Complexidade: O(n) — limitado a 500 linhas pelo FETCH FIRST
// ---------------------------------------------------------------------------
async function processarBuscaOS(requestData, reqRef) {
  const { fazendaId, codIntegracao, options } = requestData.payload

  if (!codIntegracao) {
    throw new Error("'codIntegracao' e obrigatorio para buscar Ordens de Servico.")
  }

  const codEstabel = String(codIntegracao).trim()
  const oracleResults = []

  if (isMock) {
    oracleResults.push(
      { numero: 'OS-2023-001', talhao: 'T-01', area: 150.5, produto: 'Adubo NPK 10-10-10', status: 'ABERTA', _fazendaId: fazendaId },
      { numero: 'OS-2023-002', talhao: 'T-02', area: 200.0, produto: 'Ureia Agricola', status: 'ABERTA', _fazendaId: fazendaId }
    )
  } else {
    // Filtro com os códigos das fazendas autorizadas
    const fazendasFilter = `AND OS.COD_EMPR IN ('5', '6', '21', '25', '26', '33', '34', '36', '17', '24', '18', '27', '28', '10')`
    const codEmprClause  = (codEstabel && codEstabel !== 'TODAS') ? `AND OS.COD_EMPR = :codEstabel` : ''

    const sql = `
      SELECT * FROM (
        SELECT
          OS.COD_EMPR,
          EMP.ABV_EMPR                                                           FAZENDA,
          OS.COD_OS,
          D3.COD_DIVI3                                                           TALHAO,
          ESP.ESP_MEDIDA_1                                                       ESP_RUA,
          CASE WHEN OS.OS_STATUS = 1 THEN 'FECHADA' ELSE 'ABERTA' END           STATUS_OS,
          OS.COD_EMPR || '.' || D3.COD_DIVI3                                    IDPBI,
          OS.DATA_OS,
          LANC.DATA_LANCAMENTO                                                   DT_SERVICO,
          TOA.ID_OPER,
          TOA.ID_OPER || ' - ' || TOA.DSC_OPER                                  ID_DSC_OPER,
          TOA.DSC_OPER,
          COUNT(DISTINCT D3.COD_DIVI3) OVER (PARTITION BY OS.COD_OS)            CTALHAO,
          GOP.COD_ITEM                                                           IT,
          CASE WHEN ITEM.DESC_ITEM IS NULL THEN 'SEM PRODUTO' ELSE ITEM.DESC_ITEM END DSC_IT,
          GOP.COD_ITEM,
          GOP.OSP_QTDE_APLIC                                                     QT_APLC,
          ROUND(GOP.OSP_QTDE_APLIC / SUM(D4.DV4_AREA) OVER (PARTITION BY OS.COD_OS) * D4.DV4_AREA, 0) QT_APLC_TALHAO,
          GOP.OSP_QTDE_APLIC / SUM(D4.DV4_AREA) OVER (PARTITION BY OS.COD_OS) * D4.DV4_AREA / D4.DV4_AREA DOSE_HA,
          D4.DV4_AREA                                                            AREA
        FROM GATEC_SAF.GA_GRP_ORDEM_SERVICO OS
          LEFT JOIN GATEC_SAF.GA_GRP_SISTEMA_APLICACAO SIS
            ON OS.COD_SIST_APLIC = SIS.COD_SIST_APLIC
          LEFT JOIN GATEC_SAF.GA_GRP_OS_OPERACOES OPR
            ON OPR.ID_OS = OS.ID_OS
          LEFT JOIN GATEC_SAF.GA_OPERACAO_AGRICOLA GOA
            ON GOA.ID_S4 = OPR.ID_S4
          LEFT JOIN GATEC_SAF.GA_SUBPROCESSO SUBP
            ON SUBP.COD_PROCESSO = GOA.COD_PROCESSO
            AND SUBP.COD_SUBPROCESSO = GOA.COD_SUBPROCESSO
          LEFT JOIN GATEC_SAF.GA_PROCESSO PROC
            ON PROC.COD_PROCESSO = SUBP.COD_PROCESSO
          LEFT JOIN GATEC_SAF.GA_GRP_LANCAMENTO LANC
            ON LANC.ID_OS = OS.ID_OS
            AND LANC.COD_EMPR = OS.COD_EMPR
            AND LANC.COD_SAFRA = OS.COD_SAFRA
          LEFT JOIN GATEC_SAF.GA_GRP_OS_PRODUTOS GOP
            ON GOP.COD_EMPR = OS.COD_EMPR
            AND GOP.ID_OS = OPR.ID_OS
            AND GOP.ID_S4 = OPR.ID_S4
          LEFT JOIN GATEC_SAF.GA_TABGR_OPER_AGRIC TOA
            ON TOA.ID_OPER = GOA.ID_OPER
          LEFT JOIN GATEC_SAF.GA_GRP_OS_LOCAIS LOC
            ON LOC.ID_OS = OS.ID_OS
          LEFT JOIN EMS2CAD.ITEM ITEM
            ON ITEM.IT_CODIGO = GOP.COD_ITEM
          LEFT JOIN GATEC_SAF.GA_SAF_DIVI4 D4
            ON D4.ID_DIVI4 = LOC.ID_DIVI4
            AND D4.COD_SAFRA = OS.COD_SAFRA
          LEFT JOIN GATEC_SAF.GA_SAF_ESPACAMENTO ESP
            ON ESP.COD_ESPACAMENTO = D4.COD_ESPACAMENTO
          LEFT JOIN GATEC_SAF.GA_SAF_DIVI3 D3
            ON D4.ID_DIVI3 = D3.ID_DIVI3
          INNER JOIN GATEC_SAF.GA_EMPR EMP
            ON OS.COD_EMPR = EMP.COD_EMPR
          LEFT JOIN GATEC_SAF.GA_FUNCIONARIO FUNC
            ON OS.COD_SOLICITANTE = FUNC.COD_FUNC
            AND OS.COD_EMPR = FUNC.COD_EMPR
        WHERE OS.DATA_OS >= (SYSDATE - 365)
          AND TOA.ID_OPER IN (11, 16)
          AND (LANC.DATA_LANCAMENTO >= (SYSDATE - 365) OR LANC.DATA_LANCAMENTO IS NULL)
          ${codEmprClause}
          ${fazendasFilter}
        GROUP BY
          OS.COD_EMPR, EMP.ABV_EMPR, OS.COD_OS, D3.COD_DIVI3, ESP.ESP_MEDIDA_1,
          OS.ID_OS, OS.DATA_OS, LANC.DATA_LANCAMENTO, TOA.ID_OPER, TOA.DSC_OPER,
          OS.COD_SIST_APLIC, OS.ID_RECEITUARIO, GOP.COD_ITEM, ITEM.DESC_ITEM,
          GOP.OSP_QTDE_APLIC, D4.DV4_PLANTAS, D4.DV4_AREA, OS.OS_STATUS
        ORDER BY OS.DATA_OS DESC
      )
      FETCH FIRST 500 ROWS ONLY
    `

    const bindParams = (codEstabel && codEstabel !== 'TODAS') ? [codEstabel] : []
    const result = await oracleConnection.execute(sql, bindParams, { outFormat: oracledb.OUT_FORMAT_OBJECT })
    result.rows.forEach(r => oracleResults.push(r))
  }

  await updateDoc(reqRef, {
    status: 'concluido',
    resultado: oracleResults,
    processadoEm: serverTimestamp()
  })

  console.log(`BUSCAR_OS -> ${oracleResults.length} OS(s) encontrada(s).`)
}

// ---------------------------------------------------------------------------
// MAPA DE AÇÕES — padrão Strategy/Command
// Para adicionar nova acao: inclua aqui sem alterar o restante do agent.
// ---------------------------------------------------------------------------
const handlers = {
  BUSCAR_EQUIPAMENTOS: processarBuscaEquipamentos,
  BUSCAR_OS: processarBuscaOS
  // NOVA_ACAO: processarNovaAcao,
}

// ---------------------------------------------------------------------------
// INICIALIZAÇÃO DO AGENT
// ---------------------------------------------------------------------------
async function startAgent() {
  try {
    console.log('Autenticando no Firebase com:', APP_EMAIL)
    const { user } = await signInWithEmailAndPassword(auth, APP_EMAIL, APP_PASSWORD)

    const userMetaSnap = await getDoc(doc(db, 'userMeta', user.uid))
    if (!userMetaSnap.exists()) {
      console.error('Usuario do Agent nao possui vinculo com nenhuma empresa.')
      process.exit(1)
    }

    agentTenantId = userMetaSnap.data().tenantId
    console.log(`Autenticado! Tenant: ${agentTenantId}`)
    console.log(`Acoes suportadas: ${Object.keys(handlers).join(', ')}`)
    console.log('Aguardando requisicoes...\n')

    const requestsRef = collection(db, 'tenants', agentTenantId, 'sync_requests')
    const qPending = query(requestsRef, where('status', '==', 'pendente'))

    onSnapshot(qPending, async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        if (change.type !== 'added') continue

        const reqDoc = change.doc
        const requestData = reqDoc.data()
        const { acao } = requestData

        console.log(`\nNova Requisicao: [${acao}] - ID: ${reqDoc.id}`)

        try {
          await updateDoc(reqDoc.ref, { status: 'processando', atualizadoEm: serverTimestamp() })

          const connected = await connectToOracle()
          if (!connected) throw new Error('Falha ao comunicar com o Oracle.')

          const handler = handlers[acao]
          if (!handler) throw new Error(`Acao nao reconhecida: ${acao}`)

          await handler(requestData, reqDoc.ref)
        } catch (err) {
          console.error(`Erro ao processar ${reqDoc.id}:`, err.message)
          try {
            await updateDoc(reqDoc.ref, {
              status: 'erro',
              erro: err.message,
              processadoEm: serverTimestamp()
            })
          } catch { }
        }
      }
    })
  } catch (err) {
    console.error('Falha critica no Agent:', err.message)
    process.exit(1)
  }
}

startAgent()
