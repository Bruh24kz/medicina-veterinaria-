/**
 * VetCare - Sistema Clínica Veterinária
 * Backend Express + SQLite (compatível com GitHub Codespaces)
 */
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0'; // necessário no Codespace
const DB_PATH = path.join(__dirname, 'siscristovao.db');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Erro ao abrir banco:', err.message);
  } else {
    console.log('Banco conectado:', DB_PATH);
  }
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS agendamentos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome_tutor TEXT NOT NULL,
      email TEXT NOT NULL,
      telefone TEXT NOT NULL,
      nome_pet TEXT NOT NULL,
      especie TEXT NOT NULL,
      raca TEXT,
      idade TEXT,
      peso TEXT,
      servico TEXT NOT NULL,
      data TEXT NOT NULL,
      horario TEXT NOT NULL,
      observacoes TEXT,
      status TEXT DEFAULT 'pendente',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      descricao TEXT,
      preco REAL NOT NULL,
      categoria TEXT NOT NULL,
      emoji TEXT DEFAULT '🛒',
      estoque INTEGER DEFAULT 100,
      ativo INTEGER DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome_cliente TEXT,
      telefone TEXT,
      total REAL NOT NULL,
      status TEXT DEFAULT 'pendente',
      itens_json TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  db.get('SELECT COUNT(*) AS total FROM produtos', (err, row) => {
    if (!err && row && row.total === 0) {
      const seed = [
        ['Ração Premium Cães', 'Alimento completo. 15kg', 189.9, 'racao', '🦴'],
        ['Ração Premium Gatos', 'Fórmula balanceada. 10kg', 159.9, 'racao', '🐱'],
        ['Vermífugo Canino', 'Para cães 10-20kg', 42.0, 'medicamento', '💉'],
        ['Shampoo Antipulgas', '500ml - Cães e gatos', 38.9, 'higiene', '🧴'],
        ['Suplemento Articular', 'Para cães idosos', 79.9, 'medicamento', '💊'],
        ['Brinquedo Interativo', 'Bola com apito', 29.9, 'acessorio', '🎾'],
        ['Ração Filhotes', 'Crescimento saudável. 10kg', 149.9, 'racao', '🦴'],
        ['Antipulgas Spot-On', 'Proteção mensal', 65.0, 'medicamento', '💉'],
        ['Areia Higienica', '5kg - Controle de odor', 34.9, 'higiene', '🧴'],
        ['Coleira Ajustável', 'Tamanho M', 45.0, 'acessorio', '🎾']
      ];
      const stmt = db.prepare(
        'INSERT INTO produtos (nome, descricao, preco, categoria, emoji) VALUES (?, ?, ?, ?, ?)'
      );
      seed.forEach((p) => stmt.run(p));
      stmt.finalize(() => console.log('Produtos iniciais inseridos.'));
    }
  });
});

// ---------- AGENDAMENTOS ----------
app.post('/api/agendamentos', (req, res) => {
  const {
    nome, email, telefone,
    nomePet, especie, raca, idade, peso,
    servico, data, horario, observacoes
  } = req.body;

  if (!nome || !email || !telefone || !nomePet || !especie || !servico || !data || !horario) {
    return res.status(400).json({ success: false, error: 'Preencha todos os campos obrigatórios.' });
  }

  const sql = `
    INSERT INTO agendamentos
      (nome_tutor, email, telefone, nome_pet, especie, raca, idade, peso, servico, data, horario, observacoes, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pendente')
  `;

  db.run(
    sql,
    [nome, email, telefone, nomePet, especie, raca || null, idade || null, peso || null, servico, data, horario, observacoes || null],
    function (err) {
      if (err) {
        console.error(err);
        return res.status(500).json({ success: false, error: err.message });
      }
      res.json({ success: true, id: this.lastID, message: 'Agendamento registrado com sucesso!' });
    }
  );
});

app.get('/api/agendamentos', (req, res) => {
  const { data, status, busca } = req.query;
  let sql = 'SELECT * FROM agendamentos WHERE 1=1';
  const params = [];

  if (data) { sql += ' AND data = ?'; params.push(data); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (busca) {
    sql += ' AND (nome_tutor LIKE ? OR nome_pet LIKE ? OR telefone LIKE ?)';
    const q = `%${busca}%`;
    params.push(q, q, q);
  }
  sql += ' ORDER BY data DESC, horario ASC';

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/agendamentos/:id', (req, res) => {
  db.get('SELECT * FROM agendamentos WHERE id = ?', [req.params.id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Agendamento não encontrado' });
    res.json(row);
  });
});

app.patch('/api/agendamentos/:id/status', (req, res) => {
  const { status } = req.body;
  const permitidos = ['pendente', 'confirmado', 'cancelado', 'concluido'];
  if (!permitidos.includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }
  db.run('UPDATE agendamentos SET status = ? WHERE id = ?', [status, req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Agendamento não encontrado' });
    res.json({ success: true, status });
  });
});

// ---------- PRODUTOS ----------
app.get('/api/produtos', (req, res) => {
  const { categoria } = req.query;
  let sql = 'SELECT * FROM produtos WHERE ativo = 1';
  const params = [];
  if (categoria && categoria !== 'todos') {
    sql += ' AND categoria = ?';
    params.push(categoria);
  }
  sql += ' ORDER BY nome ASC';
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ---------- PEDIDOS ----------
app.post('/api/pedidos', (req, res) => {
  const { nome_cliente, telefone, total, itens } = req.body;
  if (!total || !itens || !Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ success: false, error: 'Pedido inválido' });
  }
  db.run(
    'INSERT INTO pedidos (nome_cliente, telefone, total, itens_json, status) VALUES (?, ?, ?, ?, ?)',
    [nome_cliente || null, telefone || null, total, JSON.stringify(itens), 'pendente'],
    function (err) {
      if (err) return res.status(500).json({ success: false, error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

app.get('/api/pedidos', (req, res) => {
  db.all('SELECT * FROM pedidos ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Health check (útil no Codespace)
app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: fs.existsSync(DB_PATH) });
});

app.listen(PORT, HOST, () => {
  console.log('====================================================');
  console.log('VetCare rodando em http://' + HOST + ':' + PORT);
  console.log('Banco: siscristovao.db');
  console.log('No Codespace: abra a porta ' + PORT + ' (Forwarded Ports)');
  console.log('====================================================');
});

process.on('SIGINT', () => {
  db.close(() => process.exit(0));
});
