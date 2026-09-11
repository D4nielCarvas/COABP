const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const ROOT = path.join(__dirname);
const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

// ---------------------------------------------------------------------------
// BASE DE DADOS DO GATEWAY DE EQUIPAMENTOS (Compatível com GATEC MEC / Oracle)
// ---------------------------------------------------------------------------
const DATA_FILE = path.join(ROOT, 'data', 'equipamentos.json');

const FAZENDAS_GATEWAY = [
  { codigo: '5',  nome: '5 - São Manoel' },
  { codigo: '6',  nome: '6 - Tangara' },
  { codigo: '21', nome: '21 - São Pedro' },
  { codigo: '25', nome: '25 - São Judas' },
  { codigo: '26', nome: '26 - São Francisco' },
  { codigo: '33', nome: '33 - Santana' },
  { codigo: '34', nome: '34 - Santa Eliza' },
  { codigo: '36', nome: '36 - Santa Francisca' },
  { codigo: '17', nome: '17 - Santa Lucia 1' },
  { codigo: '24', nome: '24 - Santa Lucia 2' },
  { codigo: '18', nome: '18 - Caroline' },
  { codigo: '27', nome: '27 - São João' },
  { codigo: '28', nome: '28 - Santa Luzia' },
  { codigo: '10', nome: '10 - Santa Adelina' }
];

const DEFAULT_EQUIPAMENTOS_GATEWAY = [
  // 5 - São Manoel
  { COD_EMPR: '5', codigo: 'TR-501',  frota: 'F-501',   placa: 'ABC-5001', descricao: 'TRATOR JOHN DEERE 8320R', ano: 2021, chassi: '1RW8320R501', proprietario: 'PROPRIO' },
  { COD_EMPR: '5', codigo: 'TR-502',  frota: 'F-502',   placa: 'ABC-5002', descricao: 'TRATOR JOHN DEERE 7230J', ano: 2022, chassi: '1RW7230J502', proprietario: 'PROPRIO' },
  { COD_EMPR: '5', codigo: 'CL-501',  frota: 'F-503',   placa: 'XYZ-5001', descricao: 'COLHEITADEIRA CASE IH 8250', ano: 2022, chassi: 'YKG08250501', proprietario: 'PROPRIO' },
  { COD_EMPR: '5', codigo: 'CL-502',  frota: 'F-504',   placa: 'XYZ-5002', descricao: 'COLHEITADEIRA JOHN DEERE S790', ano: 2023, chassi: 'JDS0790504', proprietario: 'PROPRIO' },
  { COD_EMPR: '5', codigo: 'PV-501',  frota: 'P-501',   placa: 'DEF-5001', descricao: 'PULVERIZADOR JACTO UNIPORT 3030', ano: 2023, chassi: 'JCT3030501', proprietario: 'PROPRIO' },
  { COD_EMPR: '5', codigo: 'PL-501',  frota: 'PL-501',  placa: '',         descricao: 'PLANTADEIRA JOHN DEERE DB50 24L', ano: 2020, chassi: 'PLNT0050501', proprietario: 'PROPRIO' },
  { COD_EMPR: '5', codigo: 'CM-501',  frota: 'CAM-501', placa: 'GHI-5001', descricao: 'CAMINHÃO PIPA MERCEDES ATEGO 2426', ano: 2020, chassi: 'MBA2426501', proprietario: 'PROPRIO' },
  { COD_EMPR: '5', codigo: 'TB-501',  frota: 'TB-501',  placa: '',         descricao: 'TRANSBORDO GRANELEIRO JAN TANDEM 20000', ano: 2021, chassi: 'JAN20000501', proprietario: 'PROPRIO' },

  // 6 - Tangara
  { COD_EMPR: '6', codigo: 'TR-601',  frota: 'F-601',   placa: 'GHI-6001', descricao: 'TRATOR NEW HOLLAND T7.245', ano: 2021, chassi: 'NHT7245601', proprietario: 'PROPRIO' },
  { COD_EMPR: '6', codigo: 'TR-602',  frota: 'F-602',   placa: 'GHI-6002', descricao: 'TRATOR CASE MAGNUM 340', ano: 2023, chassi: 'CAS340602', proprietario: 'PROPRIO' },
  { COD_EMPR: '6', codigo: 'CL-601',  frota: 'F-603',   placa: 'XYZ-6001', descricao: 'COLHEITADEIRA CASE IH 9250', ano: 2023, chassi: 'CIH9250601', proprietario: 'PROPRIO' },
  { COD_EMPR: '6', codigo: 'PV-601',  frota: 'P-601',   placa: 'DEF-6001', descricao: 'PULVERIZADOR JOHN DEERE M4040', ano: 2022, chassi: 'JDM4040601', proprietario: 'PROPRIO' },
  { COD_EMPR: '6', codigo: 'PL-601',  frota: 'PL-601',  placa: '',         descricao: 'PLANTADEIRA CASE EARLY RISER 2150 24L', ano: 2021, chassi: 'PLNT2150601', proprietario: 'PROPRIO' },
  { COD_EMPR: '6', codigo: 'CM-601',  frota: 'CAM-601', placa: 'JKL-6001', descricao: 'CAMINHÃO MELOSA VW CONSTELLATION 26.280', ano: 2021, chassi: 'VWC26280601', proprietario: 'PROPRIO' },
  { COD_EMPR: '6', codigo: 'TB-601',  frota: 'TB-601',  placa: '',         descricao: 'TRANSBORDO STARA REBOQUE INOX 25000', ano: 2022, chassi: 'STR25000601', proprietario: 'PROPRIO' },

  // 21 - São Pedro
  { COD_EMPR: '21', codigo: 'TR-2101', frota: 'F-2101',  placa: 'JKL-2101', descricao: 'TRATOR VALTRA T250 CVT', ano: 2022, chassi: 'VLT2502101', proprietario: 'PROPRIO' },
  { COD_EMPR: '21', codigo: 'TR-2102', frota: 'F-2102',  placa: 'JKL-2102', descricao: 'TRATOR JOHN DEERE 8370R', ano: 2023, chassi: '1RW8370R2102', proprietario: 'PROPRIO' },
  { COD_EMPR: '21', codigo: 'CL-2101', frota: 'F-2103',  placa: 'MNO-2101', descricao: 'COLHEITADEIRA NEW HOLLAND CR 8.90', ano: 2022, chassi: 'NHCR8902101', proprietario: 'PROPRIO' },
  { COD_EMPR: '21', codigo: 'PV-2101', frota: 'P-2101',  placa: 'STU-2102', descricao: 'PULVERIZADOR JOHN DEERE M4040', ano: 2022, chassi: 'JDM40402102', proprietario: 'PROPRIO' },
  { COD_EMPR: '21', codigo: 'PL-2101', frota: 'PL-2101', placa: '',         descricao: 'PLANTADEIRA STARA ESTRELA 32', ano: 2022, chassi: 'STRESTR2101', proprietario: 'PROPRIO' },
  { COD_EMPR: '21', codigo: 'CM-2101', frota: 'CAM-2101',placa: 'PQR-2101', descricao: 'CAMINHÃO PIPA IVECO TECTOR 240E28', ano: 2020, chassi: 'IVC240E2101', proprietario: 'PROPRIO' },
  { COD_EMPR: '21', codigo: 'TB-2101', frota: 'TB-2101', placa: '',         descricao: 'TRANSBORDO GRANELEIRO GTS TERRUS 24000', ano: 2022, chassi: 'GTST24002101', proprietario: 'PROPRIO' },

  // 25 - São Judas
  { COD_EMPR: '25', codigo: 'TR-2501', frota: 'F-2501',  placa: 'PQR-2501', descricao: 'TRATOR CASE MAGNUM 340', ano: 2023, chassi: 'CAS3402501', proprietario: 'PROPRIO' },
  { COD_EMPR: '25', codigo: 'TR-2502', frota: 'F-2502',  placa: 'PQR-2502', descricao: 'TRATOR JOHN DEERE 8400R', ano: 2023, chassi: '1RW8400R2502', proprietario: 'PROPRIO' },
  { COD_EMPR: '25', codigo: 'CL-2501', frota: 'F-2503',  placa: 'MNO-2502', descricao: 'COLHEITADEIRA JOHN DEERE S790', ano: 2023, chassi: 'JDS7902502', proprietario: 'PROPRIO' },
  { COD_EMPR: '25', codigo: 'PV-2501', frota: 'P-2501',  placa: 'STU-2501', descricao: 'PULVERIZADOR JACTO UNIPORT 4530', ano: 2023, chassi: 'JCT45302501', proprietario: 'PROPRIO' },
  { COD_EMPR: '25', codigo: 'PL-2501', frota: 'PL-2501', placa: '',         descricao: 'PLANTADEIRA JOHN DEERE DB40 30L', ano: 2021, chassi: 'PLNTDB402501', proprietario: 'PROPRIO' },
  { COD_EMPR: '25', codigo: 'CM-2501', frota: 'CAM-2501',placa: 'VWX-2501', descricao: 'CAMINHÃO OFICINA MERCEDES AXOR 3344', ano: 2021, chassi: 'MBA33442501', proprietario: 'PROPRIO' },
  { COD_EMPR: '25', codigo: 'TB-2501', frota: 'TB-2501', placa: '',         descricao: 'TRANSBORDO JAN TANDEM 25000', ano: 2022, chassi: 'JAN250002501', proprietario: 'PROPRIO' },

  // 26 - São Francisco
  { COD_EMPR: '26', codigo: 'TR-2601', frota: 'F-2601',  placa: 'VWX-2601', descricao: 'TRATOR JOHN DEERE 7230J', ano: 2022, chassi: 'JD72302601', proprietario: 'PROPRIO' },
  { COD_EMPR: '26', codigo: 'TR-2602', frota: 'F-2602',  placa: 'VWX-2602', descricao: 'TRATOR CASE PUMA 230', ano: 2022, chassi: 'CAS2302602', proprietario: 'PROPRIO' },
  { COD_EMPR: '26', codigo: 'CL-2601', frota: 'F-2603',  placa: 'YZA-2601', descricao: 'COLHEITADEIRA CASE IH 8250', ano: 2022, chassi: 'CIH82502601', proprietario: 'PROPRIO' },
  { COD_EMPR: '26', codigo: 'PV-2601', frota: 'P-2601',  placa: 'BCD-2601', descricao: 'PULVERIZADOR JACTO UNIPORT 3030', ano: 2023, chassi: 'JCT30302601', proprietario: 'PROPRIO' },
  { COD_EMPR: '26', codigo: 'PL-2601', frota: 'PL-2601', placa: '',         descricao: 'PLANTADEIRA MOMENTUM 30 LINHAS', ano: 2022, chassi: 'PLNTMOM2601', proprietario: 'PROPRIO' },
  { COD_EMPR: '26', codigo: 'CM-2601', frota: 'CAM-26',  placa: 'YZA-2602', descricao: 'CAMINHÃO PIPA MERCEDES ATEGO', ano: 2020, chassi: 'MBA24262602', proprietario: 'PROPRIO' },
  { COD_EMPR: '26', codigo: 'TB-2601', frota: 'TB-2601', placa: '',         descricao: 'TRANSBORDO CANAVIEIRO SERMAG 14T', ano: 2021, chassi: 'SRM014T2601', proprietario: 'PROPRIO' },

  // 33 - Santana
  { COD_EMPR: '33', codigo: 'TR-3301', frota: 'F-3301',  placa: 'BCD-3301', descricao: 'TRATOR MASSEY FERGUSON 8737S', ano: 2022, chassi: 'MF87373301', proprietario: 'PROPRIO' },
  { COD_EMPR: '33', codigo: 'TR-3302', frota: 'F-3302',  placa: 'BCD-3302', descricao: 'TRATOR JOHN DEERE 8320R', ano: 2023, chassi: '1RW8320R3302', proprietario: 'PROPRIO' },
  { COD_EMPR: '33', codigo: 'CL-3301', frota: 'F-3303',  placa: 'EFG-3301', descricao: 'COLHEITADEIRA JOHN DEERE S680', ano: 2021, chassi: 'JDS6803301', proprietario: 'PROPRIO' },
  { COD_EMPR: '33', codigo: 'PV-3301', frota: 'P-3301',  placa: 'HIJ-3301', descricao: 'PULVERIZADOR JOHN DEERE M4040', ano: 2023, chassi: 'JDM40403301', proprietario: 'PROPRIO' },
  { COD_EMPR: '33', codigo: 'PL-3301', frota: 'PL-3301', placa: '',         descricao: 'PLANTADEIRA DB50 EXACTEMERGE 24L', ano: 2022, chassi: 'PLNTEXACT3301', proprietario: 'PROPRIO' },
  { COD_EMPR: '33', codigo: 'CM-3301', frota: 'CAM-3301',placa: 'KLM-3301', descricao: 'CAMINHÃO MELOSA VOLVO FMX 380', ano: 2021, chassi: 'VFMX3803301', proprietario: 'PROPRIO' },
  { COD_EMPR: '33', codigo: 'TB-3301', frota: 'TB-3301', placa: '',         descricao: 'TRANSBORDO GTS TERRUS 24000', ano: 2022, chassi: 'GTST24003301', proprietario: 'PROPRIO' },

  // 34 - Santa Eliza
  { COD_EMPR: '34', codigo: 'TR-3401', frota: 'F-3401',  placa: 'EFG-3401', descricao: 'TRATOR JOHN DEERE 6190M', ano: 2021, chassi: 'JD61903401', proprietario: 'PROPRIO' },
  { COD_EMPR: '34', codigo: 'TR-3402', frota: 'F-3402',  placa: 'EFG-3402', descricao: 'TRATOR JOHN DEERE 7215J', ano: 2022, chassi: 'JD72153402', proprietario: 'PROPRIO' },
  { COD_EMPR: '34', codigo: 'CL-3401', frota: 'F-3403',  placa: 'HIJ-3401', descricao: 'COLHEITADEIRA CASE IH 9250', ano: 2023, chassi: 'CIH92503401', proprietario: 'PROPRIO' },
  { COD_EMPR: '34', codigo: 'PV-3401', frota: 'P-3401',  placa: 'KLM-3401', descricao: 'PULVERIZADOR JACTO UNIPORT 4530', ano: 2023, chassi: 'JCT45303401', proprietario: 'PROPRIO' },
  { COD_EMPR: '34', codigo: 'PL-3401', frota: 'PL-3401', placa: '',         descricao: 'PLANTADEIRA CASE EARLY RISER 2150 24L', ano: 2021, chassi: 'PLNT21503401', proprietario: 'PROPRIO' },
  { COD_EMPR: '34', codigo: 'CM-3401', frota: 'CAM-3401',placa: 'NOP-3401', descricao: 'CAMINHÃO PIPA VW CONSTELLATION 24.280', ano: 2021, chassi: 'VWC242803401', proprietario: 'PROPRIO' },
  { COD_EMPR: '34', codigo: 'TB-3401', frota: 'TB-3401', placa: '',         descricao: 'TRANSBORDO JAN TANDEM 20000', ano: 2021, chassi: 'JAN200003401', proprietario: 'PROPRIO' },

  // 36 - Santa Francisca
  { COD_EMPR: '36', codigo: 'TR-3601', frota: 'F-3601',  placa: 'HIJ-3601', descricao: 'TRATOR JOHN DEERE 8345R', ano: 2022, chassi: '1RW8345R3601', proprietario: 'PROPRIO' },
  { COD_EMPR: '36', codigo: 'TR-3602', frota: 'F-3602',  placa: 'HIJ-3602', descricao: 'TRATOR NEW HOLLAND T8.385', ano: 2022, chassi: 'NHT83853602', proprietario: 'PROPRIO' },
  { COD_EMPR: '36', codigo: 'CL-3601', frota: 'F-3603',  placa: 'KLM-3601', descricao: 'COLHEITADEIRA CASE IH 9250', ano: 2023, chassi: 'CIH92503601', proprietario: 'PROPRIO' },
  { COD_EMPR: '36', codigo: 'PV-3601', frota: 'P-3601',  placa: 'NOP-3601', descricao: 'PULVERIZADOR JACTO UNIPORT 3030', ano: 2023, chassi: 'JCT30303601', proprietario: 'PROPRIO' },
  { COD_EMPR: '36', codigo: 'PL-3601', frota: 'PL-3601', placa: '',         descricao: 'PLANTADEIRA STARA ABSOLUTA 44', ano: 2022, chassi: 'STRABS443601', proprietario: 'PROPRIO' },
  { COD_EMPR: '36', codigo: 'CM-3601', frota: 'CAM-3601',placa: 'QRS-3601', descricao: 'CAMINHÃO PRANCHA SCANIA G440 6X4', ano: 2020, chassi: 'SCNG4403601', proprietario: 'PROPRIO' },
  { COD_EMPR: '36', codigo: 'TB-3601', frota: 'TB-3601', placa: '',         descricao: 'TRANSBORDO STARA REBOQUE INOX 25000', ano: 2022, chassi: 'STR250003601', proprietario: 'PROPRIO' },

  // 17 - Santa Lucia 1
  { COD_EMPR: '17', codigo: 'TR-1701', frota: 'F-1701',  placa: 'KLM-1701', descricao: 'TRATOR NEW HOLLAND T8.385', ano: 2022, chassi: 'NHT83851701', proprietario: 'PROPRIO' },
  { COD_EMPR: '17', codigo: 'TR-1702', frota: 'F-1702',  placa: 'KLM-1702', descricao: 'TRATOR JOHN DEERE 7230J', ano: 2022, chassi: '1RW7230J1702', proprietario: 'PROPRIO' },
  { COD_EMPR: '17', codigo: 'CL-1701', frota: 'F-1703',  placa: 'NOP-1701', descricao: 'COLHEITADEIRA JOHN DEERE S790', ano: 2023, chassi: 'JDS7901701', proprietario: 'PROPRIO' },
  { COD_EMPR: '17', codigo: 'PV-1701', frota: 'P-1701',  placa: 'QRS-1701', descricao: 'PULVERIZADOR JOHN DEERE M4040', ano: 2022, chassi: 'JDM40401701', proprietario: 'PROPRIO' },
  { COD_EMPR: '17', codigo: 'PL-1701', frota: 'PL-1701', placa: '',         descricao: 'PLANTADEIRA JOHN DEERE DB50 24L', ano: 2021, chassi: 'PLNTDB501701', proprietario: 'PROPRIO' },
  { COD_EMPR: '17', codigo: 'CM-1701', frota: 'CAM-1701',placa: 'TUV-1701', descricao: 'CAMINHÃO PIPA MERCEDES ATEGO 2426', ano: 2020, chassi: 'MBA24261701', proprietario: 'PROPRIO' },
  { COD_EMPR: '17', codigo: 'TB-1701', frota: 'TB-1701', placa: '',         descricao: 'TRANSBORDO GTS TERRUS 24000', ano: 2022, chassi: 'GTST24001701', proprietario: 'PROPRIO' },

  // 24 - Santa Lucia 2
  { COD_EMPR: '24', codigo: 'TR-2401', frota: 'F-2401',  placa: 'NOP-2401', descricao: 'TRATOR CASE MAGNUM 380', ano: 2023, chassi: 'CAS3802401', proprietario: 'PROPRIO' },
  { COD_EMPR: '24', codigo: 'TR-2402', frota: 'F-2402',  placa: 'NOP-2402', descricao: 'TRATOR JOHN DEERE 8320R', ano: 2022, chassi: '1RW8320R2402', proprietario: 'PROPRIO' },
  { COD_EMPR: '24', codigo: 'CL-2401', frota: 'F-2403',  placa: 'QRS-2401', descricao: 'COLHEITADEIRA CASE IH 8250', ano: 2022, chassi: 'CIH82502401', proprietario: 'PROPRIO' },
  { COD_EMPR: '24', codigo: 'PV-2401', frota: 'P-2401',  placa: 'TUV-2401', descricao: 'PULVERIZADOR JACTO UNIPORT 4530', ano: 2023, chassi: 'JCT45302401', proprietario: 'PROPRIO' },
  { COD_EMPR: '24', codigo: 'PL-2401', frota: 'PL-2401', placa: '',         descricao: 'PLANTADEIRA MOMENTUM 30 LINHAS', ano: 2022, chassi: 'PLNTMOM2401', proprietario: 'PROPRIO' },
  { COD_EMPR: '24', codigo: 'CM-2401', frota: 'CAM-2401',placa: 'WXY-2401', descricao: 'CAMINHÃO MELOSA VW CONSTELLATION 26.280', ano: 2021, chassi: 'VWC262802401', proprietario: 'PROPRIO' },
  { COD_EMPR: '24', codigo: 'TB-2401', frota: 'TB-2401', placa: '',         descricao: 'TRANSBORDO CANAVIEIRO SERMAG 14T', ano: 2021, chassi: 'SRM014T2401', proprietario: 'PROPRIO' },

  // 18 - Caroline
  { COD_EMPR: '18', codigo: 'TR-1801', frota: 'F-1801',  placa: 'QRS-1801', descricao: 'TRATOR VALTRA BH 194', ano: 2021, chassi: 'VLT1941801', proprietario: 'PROPRIO' },
  { COD_EMPR: '18', codigo: 'TR-1802', frota: 'F-1802',  placa: 'QRS-1802', descricao: 'TRATOR JOHN DEERE 8400R', ano: 2023, chassi: '1RW8400R1802', proprietario: 'PROPRIO' },
  { COD_EMPR: '18', codigo: 'CL-1801', frota: 'F-1803',  placa: 'TUV-1801', descricao: 'COLHEITADEIRA JOHN DEERE S680', ano: 2022, chassi: 'JDS6801801', proprietario: 'PROPRIO' },
  { COD_EMPR: '18', codigo: 'PV-1801', frota: 'P-1801',  placa: 'WXY-1801', descricao: 'PULVERIZADOR JACTO UNIPORT 3030', ano: 2023, chassi: 'JCT30301801', proprietario: 'PROPRIO' },
  { COD_EMPR: '18', codigo: 'PL-1801', frota: 'PL-1801', placa: '',         descricao: 'PLANTADEIRA DB40 EXACTEMERGE 30L', ano: 2022, chassi: 'PLNTDB401801', proprietario: 'PROPRIO' },
  { COD_EMPR: '18', codigo: 'CM-1801', frota: 'CAM-1801',placa: 'ZAB-1801', descricao: 'CAMINHÃO PIPA IVECO TECTOR 240E28', ano: 2020, chassi: 'IVC240E1801', proprietario: 'PROPRIO' },
  { COD_EMPR: '18', codigo: 'TB-1801', frota: 'TB-1801', placa: '',         descricao: 'TRANSBORDO JAN TANDEM 20000', ano: 2021, chassi: 'JAN200001801', proprietario: 'PROPRIO' },

  // 27 - São João
  { COD_EMPR: '27', codigo: 'TR-2701', frota: 'F-2701',  placa: 'TUV-2701', descricao: 'TRATOR JOHN DEERE 8400R', ano: 2023, chassi: 'JD84002701', proprietario: 'PROPRIO' },
  { COD_EMPR: '27', codigo: 'TR-2702', frota: 'F-2702',  placa: 'TUV-2702', descricao: 'TRATOR CASE MAGNUM 340', ano: 2023, chassi: 'CAS3402702', proprietario: 'PROPRIO' },
  { COD_EMPR: '27', codigo: 'CL-2701', frota: 'F-2703',  placa: 'WXY-2701', descricao: 'COLHEITADEIRA NEW HOLLAND CR 8.90', ano: 2022, chassi: 'NHCR8902701', proprietario: 'PROPRIO' },
  { COD_EMPR: '27', codigo: 'PV-2701', frota: 'P-2701',  placa: 'ZAB-2701', descricao: 'PULVERIZADOR JOHN DEERE M4040', ano: 2022, chassi: 'JDM40402701', proprietario: 'PROPRIO' },
  { COD_EMPR: '27', codigo: 'PL-2701', frota: 'PL-2701', placa: '',         descricao: 'PLANTADEIRA CASE EARLY RISER 2150 24L', ano: 2021, chassi: 'PLNT21502701', proprietario: 'PROPRIO' },
  { COD_EMPR: '27', codigo: 'CM-2701', frota: 'CAM-2701',placa: 'BCD-2701', descricao: 'CAMINHÃO OFICINA MERCEDES AXOR 3344', ano: 2021, chassi: 'MBA33442701', proprietario: 'PROPRIO' },
  { COD_EMPR: '27', codigo: 'TB-2701', frota: 'TB-2701', placa: '',         descricao: 'TRANSBORDO GTS TERRUS 24000', ano: 2022, chassi: 'GTST24002701', proprietario: 'PROPRIO' },

  // 28 - Santa Luzia
  { COD_EMPR: '28', codigo: 'TR-2801', frota: 'F-2801',  placa: 'WXY-2801', descricao: 'TRATOR JOHN DEERE 7230J', ano: 2022, chassi: '1RW7230J2801', proprietario: 'PROPRIO' },
  { COD_EMPR: '28', codigo: 'TR-2802', frota: 'F-2802',  placa: 'WXY-2802', descricao: 'TRATOR VALTRA T250 CVT', ano: 2022, chassi: 'VLT2502802', proprietario: 'PROPRIO' },
  { COD_EMPR: '28', codigo: 'CL-2801', frota: 'F-2803',  placa: 'ZAB-2801', descricao: 'COLHEITADEIRA JOHN DEERE S680', ano: 2022, chassi: 'JDS6802801', proprietario: 'PROPRIO' },
  { COD_EMPR: '28', codigo: 'PV-2801', frota: 'P-2801',  placa: 'BCD-2801', descricao: 'PULVERIZADOR JACTO UNIPORT 4530', ano: 2023, chassi: 'JCT45302801', proprietario: 'PROPRIO' },
  { COD_EMPR: '28', codigo: 'PL-2801', frota: 'PL-2801', placa: '',         descricao: 'PLANTADEIRA STARA ESTRELA 32', ano: 2022, chassi: 'STRESTR2801', proprietario: 'PROPRIO' },
  { COD_EMPR: '28', codigo: 'CM-2801', frota: 'CAM-2801',placa: 'EFG-2801', descricao: 'CAMINHÃO PIPA MERCEDES ATEGO 2426', ano: 2020, chassi: 'MBA24262801', proprietario: 'PROPRIO' },
  { COD_EMPR: '28', codigo: 'TB-2801', frota: 'TB-2801', placa: '',         descricao: 'TRANSBORDO STARA REBOQUE INOX 25000', ano: 2022, chassi: 'STR250002801', proprietario: 'PROPRIO' },

  // 10 - Santa Adelina
  { COD_EMPR: '10', codigo: 'TR-1001', frota: 'F-1001',  placa: 'ZAB-1001', descricao: 'TRATOR CASE PUMA 230', ano: 2022, chassi: 'CAS2301001', proprietario: 'PROPRIO' },
  { COD_EMPR: '10', codigo: 'TR-1002', frota: 'F-1002',  placa: 'ZAB-1002', descricao: 'TRATOR JOHN DEERE 8320R', ano: 2022, chassi: '1RW8320R1002', proprietario: 'PROPRIO' },
  { COD_EMPR: '10', codigo: 'CL-1001', frota: 'F-1003',  placa: 'BCD-1001', descricao: 'COLHEITADEIRA CASE IH 8250', ano: 2022, chassi: 'CIH82501001', proprietario: 'PROPRIO' },
  { COD_EMPR: '10', codigo: 'PV-1001', frota: 'P-1001',  placa: 'EFG-1001', descricao: 'PULVERIZADOR JACTO UNIPORT 3030', ano: 2023, chassi: 'JCT30301001', proprietario: 'PROPRIO' },
  { COD_EMPR: '10', codigo: 'PL-1001', frota: 'PL-1001', placa: '',         descricao: 'PLANTADEIRA JOHN DEERE DB50 24L', ano: 2021, chassi: 'PLNTDB501001', proprietario: 'PROPRIO' },
  { COD_EMPR: '10', codigo: 'CM-1001', frota: 'CAM-1001',placa: 'HIJ-1001', descricao: 'CAMINHÃO MELOSA VOLVO FMX 380', ano: 2021, chassi: 'VFMX3801001', proprietario: 'PROPRIO' },
  { COD_EMPR: '10', codigo: 'TB-1001', frota: 'TB-1001', placa: '',         descricao: 'TRANSBORDO JAN TANDEM 20000', ano: 2021, chassi: 'JAN200001001', proprietario: 'PROPRIO' }
];

function getEquipamentosCatalog() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const rawItems = Array.isArray(parsed)
        ? parsed
        : (parsed.results?.[0]?.items || parsed.items || []);

      if (Array.isArray(rawItems) && rawItems.length > 0) {
        return rawItems.map(e => ({
          COD_EMPR:     String(e.COD_EMPR || e.cod_empr || '').trim(),
          codigo:       String(e.codigo || e.CODIGO || '').trim(),
          frota:        String(e.frota || e.FROTA || e.codigo || '').trim(),
          descricao:    String(e.descricao || e.DESCRICAO || '').trim(),
          ano:          e.ano || e.ANO || null,
          chassi:       String(e.chassi || e.CHASSI || '').trim(),
          placa:        String(e.placa || e.PLACA || '').trim(),
          proprietario: String(e.proprietario || e.PROPRIETARIO || '').trim()
        }));
      }
    } catch (e) {
      console.warn('Falha ao ler data/equipamentos.json, usando padrão:', e.message);
    }
  }
  return DEFAULT_EQUIPAMENTOS_GATEWAY;
}

http.createServer((req, res) => {
  const reqHost   = req.headers.host || `localhost:${PORT}`;
  const parsedUrl = new URL(req.url, `http://${reqHost}`);
  const pathname  = parsedUrl.pathname;

  // -------------------------------------------------------------------------
  // ENDPOINTS DO GATEWAY (compatível com equipment-agent)
  // -------------------------------------------------------------------------
  if (pathname === '/api/gateway/fazendas') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(FAZENDAS_GATEWAY));
    return;
  }

  if (pathname === '/api/gateway/equipamentos') {
    const fazendaCod = parsedUrl.searchParams.get('fazenda') || parsedUrl.searchParams.get('codIntegracao') || '';
    const searchTerm = (parsedUrl.searchParams.get('search') || parsedUrl.searchParams.get('searchTerm') || '').trim().toUpperCase();

    let list = getEquipamentosCatalog();
    if (fazendaCod) {
      list = list.filter(e => e.COD_EMPR === String(fazendaCod));
    }
    if (searchTerm) {
      list = list.filter(e =>
        e.codigo.toUpperCase().includes(searchTerm) ||
        e.frota.toUpperCase().includes(searchTerm) ||
        e.descricao.toUpperCase().includes(searchTerm) ||
        (e.placa && e.placa.toUpperCase().includes(searchTerm))
      );
    }

    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(list));
    return;
  }

  if (pathname === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  // -------------------------------------------------------------------------
  // ARQUIVOS ESTÁTICOS
  // -------------------------------------------------------------------------
  const reqPath = pathname === '/' ? '/index.html' : pathname;
  const file    = path.join(ROOT, reqPath);

  // Segurança: evitar path traversal
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found: ' + pathname);
      return;
    }
    const ext = path.extname(file);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT} (0.0.0.0:${PORT})`);
});
