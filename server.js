/**
 * VetCare - Backend puro (Node.js http + JSON)
 * Sem dependências externas — funciona no GitHub Codespace.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'vetcare.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function defaultDb() {
  return {
    agendamentos: [],
    produtos: [
      { id: 1, nome: 'Ração Premium Cães 15kg', descricao: 'Alimento completo', preco: 189.9, categoria: 'racao', emoji: '🦴', estoque: 100, ativo: 1 },
      { id: 2, nome: 'Ração Premium Gatos 10kg', descricao: 'Fórmula balanceada', preco: 159.9, categoria: 'racao', emoji: '🐱', estoque: 100, ativo: 1 },
      { id: 3, nome: 'Ração Filhotes 10kg', descricao: 'Crescimento saudável', preco: 149.9, categoria: 'racao', emoji: '🦴', estoque: 100, ativo: 1 },
      { id: 4, nome: 'Vermífugo Canino 10-20kg', descricao: 'Vermífugo', preco: 42.0, categoria: 'medicamento', emoji: '💉', estoque: 100, ativo: 1 },
      { id: 5, nome: 'Antipulgas Spot-On', descricao: 'Proteção mensal', preco: 65.0, categoria: 'medicamento', emoji: '💉', estoque: 100, ativo: 1 },
      { id: 6, nome: 'Suplemento Articular', descricao: 'Para cães idosos', preco: 79.9, categoria: 'medicamento', emoji: '💊', estoque: 100, ativo: 1 },
      { id: 7, nome: 'Shampoo Antipulgas 500ml', descricao: 'Cães e gatos', preco: 38.9, categoria: 'higiene', emoji: '🧴', estoque: 100, ativo: 1 },
      { id: 8, nome: 'Areia Higiênica 5kg', descricao: 'Controle de odor', preco: 34.9, categoria: 'higiene', emoji: '🧴', estoque: 100, ativo: 1 },
      { id: 9, nome: 'Coleira Ajustável M', descricao: 'Tamanho M', preco: 45.0, categoria: 'acessorio', emoji: '🎾', estoque: 100, ativo: 1 },
      { id: 10, nome: 'Brinquedo Interativo', descricao: 'Bola com apito', preco: 29.9, categoria: 'acessorio', emoji: '🎾', estoque: 100, ativo: 1 },
      { id: 11, nome: 'Comedouro Inox', descricao: 'Aço inoxidável', preco: 35.0, categoria: 'acessorio', emoji: '🥣', estoque: 100, ativo: 1 },
      { id: 12, nome: 'Petisco Natural 200g', descricao: 'Petisco saudável', preco: 22.5, categoria: 'racao', emoji: '🦴', estoque: 100, ativo: 1 }
    ],
    pedidos: [],
    _seq: { agendamentos: 1, pedidos: 1, produtos: 13 }
  };
}

function loadDb() {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const db = defaultDb();
    saveDb(db);
    console.log('Banco criado:', DB_FILE);
    return db;
  }
  try {
    const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    if (!Array.isArray(db.agendamentos)) db.agendamentos = [];
    if (!Array.isArray(db.produtos) || db.produtos.length === 0) db.produtos = defaultDb().produtos;
    if (!Array.isArray(db.pedidos)) db.pedidos = [];
    if (!db._seq) {
      db._seq = {
        agendamentos: db.agendamentos.reduce((m, a) => Math.max(m, a.id || 0), 0) + 1,
        pedidos: db.pedidos.reduce((m, a) => Math.max(m, a.id || 0), 0) + 1,
        produtos: db.produtos.reduce((m, a) => Math.max(m, a.id || 0), 0) + 1
      };
    }
    return db;
  } catch (e) {
    console.error('Erro ao ler banco, recriando:', e.message);
    const db = defaultDb();
    saveDb(db);
    return db;
  }
}

function saveDb(db) {
  ensureDataDir();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}

function nextId(db, key) {
  const id = db._seq[key] || 1;
  db._seq[key] = id + 1;
  return id;
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

function safePath(urlPath) {
  let p = decodeURIComponent(urlPath.split('?')[0]);
  if (p === '/') p = '/index.html';
  p = path.normalize(p).replace(/^(\.[.][/\\])+/, '');
  const full = path.join(ROOT, p);
  if (!full.startsWith(ROOT)) return null;
  return full;
}

async function handleApi(req, res, pathname, searchParams) {
  const method = req.method;
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  if (pathname === '/api/health' && method === 'GET') {
    const store = loadDb();
    return sendJson(res, 200, {
      ok: true,
      db: fs.existsSync(DB_FILE),
      agendamentos: store.agendamentos.length,
      produtos: store.produtos.length,
      pedidos: store.pedidos.length
    });
  }

  if (pathname === '/api/agendamentos' && method === 'POST') {
    const body = await readBody(req);
    const { nome, email, telefone, nomePet, especie, raca, idade, peso, servico, data, horario, observacoes } = body;
    if (!nome || !email || !telefone || !nomePet || !especie || !servico || !data || !horario) {
      return sendJson(res, 400, { success: false, error: 'Preencha todos os campos obrigatórios.' });
    }
    const store = loadDb();
    const item = {
      id: nextId(store, 'agendamentos'),
      nome_tutor: String(nome).trim(),
      email: String(email).trim(),
      telefone: String(telefone).trim(),
      nome_pet: String(nomePet).trim(),
      especie: String(especie).trim(),
      raca: raca ? String(raca).trim() : null,
      idade: idade ? String(idade).trim() : null,
      peso: peso ? String(peso).trim() : null,
      servico: String(servico).trim(),
      data: String(data).trim(),
      horario: String(horario).trim(),
      observacoes: observacoes ? String(observacoes).trim() : null,
      status: 'pendente',
      created_at: new Date().toISOString()
    };
    store.agendamentos.push(item);
    saveDb(store);
    console.log('Agendamento salvo id=', item.id, item.nome_tutor, item.nome_pet);
    return sendJson(res, 200, { success: true, id: item.id, message: 'Agendamento registrado com sucesso!' });
  }

  if (pathname === '/api/agendamentos' && method === 'GET') {
    const store = loadDb();
    const data = searchParams.get('data');
    const status = searchParams.get('status');
    const busca = searchParams.get('busca');
    let rows = store.agendamentos.slice();
    if (data) rows = rows.filter((r) => r.data === data);
    if (status) rows = rows.filter((r) => r.status === status);
    if (busca) {
      const q = busca.toLowerCase();
      rows = rows.filter((r) =>
        (r.nome_tutor && r.nome_tutor.toLowerCase().includes(q)) ||
        (r.nome_pet && r.nome_pet.toLowerCase().includes(q)) ||
        (r.telefone && String(r.telefone).toLowerCase().includes(q))
      );
    }
    rows.sort((a, b) => ((b.data || '') + (b.horario || '')).localeCompare((a.data || '') + (a.horario || '')));
    return sendJson(res, 200, rows);
  }

  const mGetId = pathname.match(/^\/api\/agendamentos\/(\d+)$/);
  if (mGetId && method === 'GET') {
    const store = loadDb();
    const id = parseInt(mGetId[1], 10);
    const row = store.agendamentos.find((a) => a.id === id);
    if (!row) return sendJson(res, 404, { error: 'Agendamento não encontrado' });
    return sendJson(res, 200, row);
  }

  const mStatus = pathname.match(/^\/api\/agendamentos\/(\d+)\/status$/);
  if (mStatus && method === 'PATCH') {
    const body = await readBody(req);
    const status = body.status;
    const permitidos = ['pendente', 'confirmado', 'cancelado', 'concluido'];
    if (!permitidos.includes(status)) return sendJson(res, 400, { error: 'Status inválido' });
    const store = loadDb();
    const id = parseInt(mStatus[1], 10);
    const row = store.agendamentos.find((a) => a.id === id);
    if (!row) return sendJson(res, 404, { error: 'Agendamento não encontrado' });
    row.status = status;
    saveDb(store);
    return sendJson(res, 200, { success: true, status });
  }

  if (pathname === '/api/produtos' && method === 'GET') {
    const store = loadDb();
    const categoria = searchParams.get('categoria');
    let rows = store.produtos.filter((p) => p.ativo !== 0);
    if (categoria && categoria !== 'todos') rows = rows.filter((p) => p.categoria === categoria);
    rows.sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
    return sendJson(res, 200, rows);
  }

  if (pathname === '/api/pedidos' && method === 'POST') {
    const body = await readBody(req);
    const { nome_cliente, telefone, total, itens } = body;
    if (!total || !itens || !Array.isArray(itens) || itens.length === 0) {
      return sendJson(res, 400, { success: false, error: 'Pedido inválido' });
    }
    const store = loadDb();
    const item = {
      id: nextId(store, 'pedidos'),
      nome_cliente: nome_cliente || null,
      telefone: telefone || null,
      total: Number(total),
      status: 'pendente',
      itens_json: JSON.stringify(itens),
      created_at: new Date().toISOString()
    };
    store.pedidos.push(item);
    saveDb(store);
    return sendJson(res, 200, { success: true, id: item.id });
  }

  if (pathname === '/api/pedidos' && method === 'GET') {
    const store = loadDb();
    return sendJson(res, 200, store.pedidos.slice().sort((a, b) => b.id - a.id));
  }

  return sendJson(res, 404, { error: 'Rota não encontrada' });
}

function serveStatic(req, res, pathname) {
  const full = safePath(pathname);
  if (!full) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Não encontrado: ' + pathname);
    }
    const ext = path.extname(full).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(full).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers.host || 'localhost';
    const u = new URL(req.url || '/', 'http://' + host);
    if (u.pathname.startsWith('/api/')) {
      await handleApi(req, res, u.pathname, u.searchParams);
      return;
    }
    serveStatic(req, res, u.pathname);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) sendJson(res, 500, { success: false, error: err.message });
  }
});

server.listen(PORT, HOST, () => {
  loadDb();
  console.log('====================================================');
  console.log('VetCare rodando em http://' + HOST + ':' + PORT);
  console.log('Dados salvos em: data/vetcare.json');
  console.log('No Codespace: Ports → porta ' + PORT + ' → Public / Open in Browser');
  console.log('====================================================');
});
