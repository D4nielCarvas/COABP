const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const ROOT = path.join(__dirname);
const PORT = 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

// ---------------------------------------------------------------------------
// BASE DE DADOS DO GATEWAY DE EQUIPAMENTOS (Baseado no equipment-agent / Oracle)
// ---------------------------------------------------------------------------
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

const EQUIPAMENTOS_GATEWAY = [
  // 5 - São Manoel
  { COD_EMPR: '5',  codigo: 'TR-501', frota: 'F-501', placa: 'ABC-5001', descricao: 'TRATOR JOHN DEERE 8320R', ano: 2021, chassi: '1RW8320R501', proprietario: 'PROPRIO' },
  { COD_EMPR: '5',  codigo: 'CL-501', frota: 'F-502', placa: 'XYZ-5002', descricao: 'COLHEITADEIRA CASE IH 8250', ano: 2022, chassi: 'YKG08250502', proprietario: 'PROPRIO' },
  { COD_EMPR: '5',  codigo: 'PV-501', frota: 'P-501', placa: 'DEF-5003', descricao: 'PULVERIZADOR JACTO UNIPORT 3030', ano: 2023, chassi: 'JCT3030503', proprietario: 'PROPRIO' },
  // 6 - Tangara
  { COD_EMPR: '6',  codigo: 'TR-601', frota: 'F-601', placa: 'GHI-6001', descricao: 'TRATOR NEW HOLLAND T7.245', ano: 2021, chassi: 'NHT7245601', proprietario: 'PROPRIO' },
  { COD_EMPR: '6',  codigo: 'PL-601', frota: 'F-602', placa: '',         descricao: 'PLANTADEIRA JOHN DEERE DB50', ano: 2020, chassi: 'PLNT0050602', proprietario: 'PROPRIO' },
  // 21 - São Pedro
  { COD_EMPR: '21', codigo: 'TR-2101', frota: 'F-2101', placa: 'JKL-2101', descricao: 'TRATOR VALTRA T250 CVT', ano: 2022, chassi: 'VLT2502101', proprietario: 'PROPRIO' },
  { COD_EMPR: '21', codigo: 'PV-2101', frota: 'P-2101', placa: 'STU-2102', descricao: 'PULVERIZADOR JOHN DEERE M4040', ano: 2022, chassi: 'JDM40402102', proprietario: 'PROPRIO' },
  // 25 - São Judas
  { COD_EMPR: '25', codigo: 'TR-2501', frota: 'F-2501', placa: 'PQR-2501', descricao: 'TRATOR CASE MAGNUM 340', ano: 2023, chassi: 'CAS3402501', proprietario: 'PROPRIO' },
  { COD_EMPR: '25', codigo: 'CL-2501', frota: 'F-2502', placa: 'MNO-2502', descricao: 'COLHEITADEIRA JOHN DEERE S790', ano: 2023, chassi: 'JDS7902502', proprietario: 'PROPRIO' },
  // 26 - São Francisco
  { COD_EMPR: '26', codigo: 'TR-2601', frota: 'F-2601', placa: 'VWX-2601', descricao: 'TRATOR JOHN DEERE 7230J', ano: 2022, chassi: 'JD72302601', proprietario: 'PROPRIO' },
  { COD_EMPR: '26', codigo: 'CM-2601', frota: 'CAM-26', placa: 'YZA-2602', descricao: 'CAMINHÃO PIPA MERCEDES ATEGO', ano: 2020, chassi: 'MBA24262602', proprietario: 'PROPRIO' },
  // 33 - Santana
  { COD_EMPR: '33', codigo: 'TR-3301', frota: 'F-3301', placa: 'BCD-3301', descricao: 'TRATOR MASSEY FERGUSON 8737S', ano: 2022, chassi: 'MF87373301', proprietario: 'PROPRIO' },
  // 34 - Santa Eliza
  { COD_EMPR: '34', codigo: 'TR-3401', frota: 'F-3401', placa: 'EFG-3401', descricao: 'TRATOR JOHN DEERE 6190M', ano: 2021, chassi: 'JD61903401', proprietario: 'PROPRIO' },
  // 36 - Santa Francisca
  { COD_EMPR: '36', codigo: 'CL-3601', frota: 'F-3601', placa: 'HIJ-3601', descricao: 'COLHEITADEIRA CASE IH 9250', ano: 2023, chassi: 'CIH92503601', proprietario: 'PROPRIO' },
  // 17 - Santa Lucia 1
  { COD_EMPR: '17', codigo: 'TR-1701', frota: 'F-1701', placa: 'KLM-1701', descricao: 'TRATOR NEW HOLLAND T8.385', ano: 2022, chassi: 'NHT83851701', proprietario: 'PROPRIO' },
  // 24 - Santa Lucia 2
  { COD_EMPR: '24', codigo: 'PV-2401', frota: 'P-2401', placa: 'NOP-2401', descricao: 'PULVERIZADOR JACTO UNIPORT 4530', ano: 2023, chassi: 'JCT45302401', proprietario: 'PROPRIO' },
  // 18 - Caroline
  { COD_EMPR: '18', codigo: 'TR-1801', frota: 'F-1801', placa: 'QRS-1801', descricao: 'TRATOR VALTRA BH 194', ano: 2021, chassi: 'VLT1941801', proprietario: 'PROPRIO' },
  // 27 - São João
  { COD_EMPR: '27', codigo: 'TR-2701', frota: 'F-2701', placa: 'TUV-2701', descricao: 'TRATOR JOHN DEERE 8400R', ano: 2023, chassi: 'JD84002701', proprietario: 'PROPRIO' },
  // 28 - Santa Luzia
  { COD_EMPR: '28', codigo: 'CL-2801', frota: 'F-2801', placa: 'WXY-2801', descricao: 'COLHEITADEIRA JOHN DEERE S680', ano: 2022, chassi: 'JDS6802801', proprietario: 'PROPRIO' },
  // 10 - Santa Adelina
  { COD_EMPR: '10', codigo: 'TR-1001', frota: 'F-1001', placa: 'ZAB-1001', descricao: 'TRATOR CASE PUMA 230', ano: 2022, chassi: 'CAS2301001', proprietario: 'PROPRIO' },
];

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

    let list = EQUIPAMENTOS_GATEWAY;
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
}).listen(PORT, '127.0.0.1', () => {
  console.log('Servidor rodando em http://localhost:' + PORT);
});
