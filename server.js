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
  { codigo: '01', nome: '01 - Fazenda Matriz' },
  { codigo: '02', nome: '02 - Fazenda Santa Maria' },
  { codigo: '03', nome: '03 - Fazenda Boa Vista' },
  { codigo: '04', nome: '04 - Fazenda São José' }
];

const EQUIPAMENTOS_GATEWAY = [
  { COD_EMPR: '01', codigo: 'TR-01', frota: 'F-100', placa: 'ABC-1234', descricao: 'TRATOR JOHN DEERE 8320R', ano: 2021, chassi: '1RW8320R001', proprietario: 'PROPRIO' },
  { COD_EMPR: '01', codigo: 'TR-02', frota: 'F-101', placa: 'XYZ-9876', descricao: 'COLHEITADEIRA CASE IH 8250', ano: 2022, chassi: 'YKG08250002', proprietario: 'PROPRIO' },
  { COD_EMPR: '01', codigo: 'IM-01', frota: 'IM-01', placa: '',         descricao: 'PLANTADEIRA DB50',         ano: 2020, chassi: 'PLNT0050003', proprietario: 'PROPRIO' },
  { COD_EMPR: '01', codigo: 'PV-01', frota: 'P-01',  placa: 'DEF-5678', descricao: 'PULVERIZADOR JACTO UNIPORT 3030', ano: 2023, chassi: 'JCT3030004', proprietario: 'PROPRIO' },
  { COD_EMPR: '02', codigo: 'TR-03', frota: 'F-102', placa: 'GHI-9012', descricao: 'TRATOR VALTRA T250 CVT', ano: 2022, chassi: 'VLT2500005', proprietario: 'PROPRIO' },
  { COD_EMPR: '02', codigo: 'TR-04', frota: 'F-103', placa: 'JKL-3456', descricao: 'TRATOR NEW HOLLAND T7.245', ano: 2021, chassi: 'NHT7245006', proprietario: 'PROPRIO' },
  { COD_EMPR: '02', codigo: 'PV-02', frota: 'P-02',  placa: 'STU-1122', descricao: 'PULVERIZADOR JOHN DEERE M4040', ano: 2022, chassi: 'JDM4040007', proprietario: 'PROPRIO' },
  { COD_EMPR: '03', codigo: 'CL-01', frota: 'F-200', placa: 'MNO-7890', descricao: 'COLHEITADEIRA JOHN DEERE S790', ano: 2023, chassi: 'JDS7900008', proprietario: 'PROPRIO' },
  { COD_EMPR: '03', codigo: 'TR-05', frota: 'F-201', placa: 'PQR-3344', descricao: 'TRATOR CASE MAGNUM 340', ano: 2023, chassi: 'CAS3400009', proprietario: 'PROPRIO' },
  { COD_EMPR: '04', codigo: 'TR-06', frota: 'F-301', placa: 'VWX-5566', descricao: 'TRATOR MASSEY FERGUSON 8737S', ano: 2022, chassi: 'MF87370010', proprietario: 'PROPRIO' },
  { COD_EMPR: '04', codigo: 'CM-01', frota: 'CAM-01', placa: 'YZA-7788', descricao: 'CAMINHÃO PIPA MERCEDES ATEGO', ano: 2020, chassi: 'MBA24260011', proprietario: 'PROPRIO' },
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
