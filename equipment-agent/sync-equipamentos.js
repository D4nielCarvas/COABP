/**
 * sync-equipamentos.js
 * 
 * Script standalone para exportar equipamentos do Oracle (GATEC MEC) 
 * para data/equipamentos.json — alimenta o gateway do Sistema COA.
 *
 * Uso:
 *   node sync-equipamentos.js
 *
 * Configurar variáveis em .env:
 *   ORACLE_USER=GATEC_SAF
 *   ORACLE_PASSWORD=mMbabhiy
 *   ORACLE_HOST=IP_DO_SERVIDOR
 *   ORACLE_PORT=1521
 *   ORACLE_SERVICE=NOME_DO_SERVICO_OU_SID
 */

require('dotenv').config();
const oracledb = require('oracledb');
const fs       = require('fs');
const path     = require('path');

const FAZENDAS = ['5','6','21','25','26','33','34','36','17','24','18','27','28','10'];
const OUT_FILE = path.join(__dirname, '..', 'data', 'equipamentos.json');


function buildConnectDescriptors() {
  const host    = process.env.ORACLE_HOST    || '';
  const port    = process.env.ORACLE_PORT    || '1521';
  const service = process.env.ORACLE_SERVICE || '';

  if (!host || !service) {
    console.error('❌ ORACLE_HOST e ORACLE_SERVICE são obrigatórios no .env');
    console.error('   Exemplo: ORACLE_HOST=BPA.BRANCOPERES.COM.BR  ORACLE_SERVICE=ems2cad');
    process.exit(1);
  }

  // 1. Tenta como Service Name: host:port/service
  // 2. Fallback como SID: (DESCRIPTION=...SID=...)
  return [
    `${host}:${port}/${service}`,
    `(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${host})(PORT=${port}))(CONNECT_DATA=(SID=${service})))`
  ];
}

const SQL = `
  SELECT
    EQP.COD_EMPR,
    EQP.COD_EQUIPAMENTO                     AS "codigo",
    EQP.COD_EQUIPAMENTO                     AS "frota",
    MODVER.DSC_MODELO                        AS "descricao",
    EQP.EQP_ANO_FABRIC                       AS "ano",
    EQP.EQP_CHASSI                           AS "chassi",
    EQP.EQP_PLACA                            AS "placa",
    PROPEQP.DSC_PROP_EQUIP                   AS "proprietario"
  FROM GATEC_MEC.GA_EQP_EQUIPAMENTO EQP
    LEFT JOIN GATEC_MEC.GA_EQP_MODELO_VERSAO MODVER
      ON EQP.COD_VERSAO = MODVER.COD_VERSAO
     AND EQP.COD_MODELO = MODVER.COD_MODELO
    JOIN GATEC_MEC.GA_TABGR_PROP_EQUIP PROPEQP
      ON PROPEQP.COD_PROP_EQUIP = EQP.COD_PROP_EQUIP
  WHERE EQP.EQP_STATUS = 1
    AND PROPEQP.PROP_EQUIP_TIPO = 'P'
    AND EQP.ID_CLASSE NOT IN (30, 32)
    AND EQP.COD_EMPR IN (${FAZENDAS.map(f => `'${f}'`).join(', ')})
  ORDER BY EQP.COD_EMPR, EQP.COD_EQUIPAMENTO
`;

const descriptors = buildConnectDescriptors();

async function sync() {
  console.log('🔗 Iniciando sincronização com Oracle GATEC...');
  console.log('   Usuário:', process.env.ORACLE_USER || 'GATEC_SAF');
  console.log('   Host:', process.env.ORACLE_HOST || 'BPA.BRANCOPERES.COM.BR');
  console.log('   Service/SID:', process.env.ORACLE_SERVICE || 'ems2cad\n');

  let connection = null;
  let lastError = null;

  for (const cs of descriptors) {
    try {
      console.log(`⏳ Tentando conectar: ${cs}`);
      connection = await oracledb.getConnection({
        user:          process.env.ORACLE_USER     || 'GATEC_SAF',
        password:      process.env.ORACLE_PASSWORD || 'mMbabhiy',
        connectString: cs
      });
      console.log('✅ Conexão estabelecida com sucesso!\n');
      break;
    } catch (err) {
      lastError = err;
      console.warn(`   Falha com descritor (${err.message.split('\n')[0]})`);
    }
  }

  if (!connection) {
    console.error('\n❌ Não foi possível conectar ao Oracle.');
    console.error('   Mensagem:', lastError.message);

    if (lastError.message.includes('NJS-530') || lastError.message.includes('ENOTFOUND')) {
      console.error('\n🔍 DIAGNÓSTICO DE REDE:');
      console.error('   O host "BPA.BRANCOPERES.COM.BR" não é acessível a partir desta máquina local.');
      console.error('   Ele é um endereço interno da rede corporativa da Branco Peres.');
      console.error('\n   👉 Como resolver:');
      console.error('   1. Execute a exportação dentro do servidor (ex: "srv adamantina" via RDP)');
      console.error('   OU');
      console.error('   2. Conecte à VPN corporativa da Branco Peres nesta máquina');
      console.error('   OU');
      console.error('   3. Execute o script SQL em scripts/export-equipamentos.sql no DBeaver/SQL Developer da máquina remota e salve o resultado em data/equipamentos.json');
    }
    process.exit(1);
  }

  try {
    const result = await connection.execute(SQL, [], {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      fetchTypeHandler: (metaData) => {
        if (metaData.name === 'COD_EMPR') return { converter: v => String(v) };
      }
    });

    const rows = result.rows;
    console.log(`📦 ${rows.length} equipamento(s) encontrado(s) no Oracle.`);

    const byFarm = {};
    rows.forEach(r => {
      const cod = r.COD_EMPR;
      byFarm[cod] = (byFarm[cod] || 0) + 1;
    });
    Object.entries(byFarm).forEach(([cod, n]) => {
      console.log(`   Fazenda ${cod}: ${n} equipamento(s)`);
    });

    const dataDir = path.dirname(OUT_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(OUT_FILE, JSON.stringify(rows, null, 2), 'utf-8');
    console.log(`\n💾 Exportado com sucesso para: ${OUT_FILE}`);
    console.log('🚀 Reinicie o server.js para servir os dados reais das frotas.');

  } catch (err) {
    console.error('\n❌ Erro ao executar query no Oracle:', err.message);
    process.exit(1);
  } finally {
    if (connection) {
      try { await connection.close(); } catch {}
    }
  }
}

sync();
