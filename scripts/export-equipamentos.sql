-- ============================================================================
-- Sistema COA — Exportação de Frotas e Equipamentos GATEC MEC (Oracle)
-- Banco / Serviço: ems2cad @ BPA.BRANCOPERES.COM.BR:1521
-- Usuário: GATEC_SAF
--
-- Como usar:
-- 1. Execute esta query no seu cliente SQL (DBeaver, SQL Developer, PL/SQL Developer)
-- 2. Exporte o resultado diretamente para JSON ou CSV
-- 3. Salve o arquivo em: c:\Projects\Sistema COA\data\equipamentos.json
-- ============================================================================

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
  -- 14 Fazendas autorizadas da Branco Peres:
  AND EQP.COD_EMPR IN (
    '5',   -- São Manoel
    '6',   -- Tangara
    '21',  -- São Pedro
    '25',  -- São Judas
    '26',  -- São Francisco
    '33',  -- Santana
    '34',  -- Santa Eliza
    '36',  -- Santa Francisca
    '17',  -- Santa Lucia 1
    '24',  -- Santa Lucia 2
    '18',  -- Caroline
    '27',  -- São João
    '28',  -- Santa Luzia
    '10'   -- Santa Adelina
  )
ORDER BY EQP.COD_EMPR, EQP.COD_EQUIPAMENTO;
