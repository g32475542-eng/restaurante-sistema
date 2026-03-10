const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend/src')));

// Sessões para login
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db' }),
  secret: 'restaurante-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: false
  }
}));

// ========== BANCO DE DADOS ==========
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'restaurante.db');
const db = new sqlite3.Database(dbPath);

// Criar tabelas e inserir dados
db.serialize(() => {
  // Tabela de usuários
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    usuario TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabela de categorias
  db.run(`CREATE TABLE IF NOT EXISTS categorias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT UNIQUE NOT NULL,
    icone TEXT DEFAULT '📋',
    cor TEXT DEFAULT '#4CAF50',
    ordem INTEGER DEFAULT 0,
    ativo INTEGER DEFAULT 1
  )`);

  // Tabela de cardápio
  db.run(`CREATE TABLE IF NOT EXISTS cardapio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    preco REAL NOT NULL,
    categoria_id INTEGER,
    descricao TEXT,
    disponivel INTEGER DEFAULT 1,
    tempo_preparo INTEGER DEFAULT 15,
    FOREIGN KEY (categoria_id) REFERENCES categorias (id)
  )`);

  // Tabela de mesas
  db.run(`CREATE TABLE IF NOT EXISTS mesas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero INTEGER UNIQUE NOT NULL,
    status TEXT DEFAULT 'livre',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Limpar e recriar usuários (garantia)
  db.run("DELETE FROM usuarios");
  
  // Inserir usuários com hash correto
  const salt = bcrypt.genSaltSync(10);
  const senhaAdmin = bcrypt.hashSync('123456', salt);
  const senhaJoao = bcrypt.hashSync('123456', salt);
  const senhaMaria = bcrypt.hashSync('123456', salt);
  
  db.run("INSERT INTO usuarios (nome, usuario, senha, tipo) VALUES (?, ?, ?, ?)",
    ['Administrador', 'admin', senhaAdmin, 'admin']);
  
  db.run("INSERT INTO usuarios (nome, usuario, senha, tipo) VALUES (?, ?, ?, ?)",
    ['João Garçom', 'joao', senhaJoao, 'garcom']);
  
  db.run("INSERT INTO usuarios (nome, usuario, senha, tipo) VALUES (?, ?, ?, ?)",
    ['Maria Cozinha', 'maria', senhaMaria, 'cozinha']);

  // Inserir categorias se não existirem
  db.get("SELECT COUNT(*) as count FROM categorias", (err, row) => {
    if (row.count === 0) {
      const categorias = [
        ['Entradas', '🥗', '#4CAF50', 1],
        ['Pratos', '🍽️', '#FF5722', 2],
        ['Bebidas', '🥤', '#2196F3', 3],
        ['Sobremesas', '🍰', '#9C27B0', 4]
      ];
      categorias.forEach(cat => {
        db.run("INSERT INTO categorias (nome, icone, cor, ordem) VALUES (?, ?, ?, ?)", cat);
      });
    }
  });

  // Inserir mesas
  db.get("SELECT COUNT(*) as count FROM mesas", (err, row) => {
    if (row.count === 0) {
      for (let i = 1; i <= 20; i++) {
        db.run("INSERT INTO mesas (numero, status) VALUES (?, ?)", [i, 'livre']);
      }
    }
  });

  console.log('✅ Banco de dados inicializado com sucesso!');
});

// ========== ROTAS ==========
app.post('/api/login', (req, res) => {
  const { usuario, senha } = req.body;
  
  db.get("SELECT * FROM usuarios WHERE usuario = ?", [usuario], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
    }
    
    const senhaValida = bcrypt.compareSync(senha, user.senha);
    
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
    }
    
    req.session.userId = user.id;
    req.session.userTipo = user.tipo;
    req.session.userNome = user.nome;
    
    res.json({
      id: user.id,
      nome: user.nome,
      usuario: user.usuario,
      tipo: user.tipo
    });
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }
  
  db.get("SELECT id, nome, usuario, tipo FROM usuarios WHERE id = ?", 
    [req.session.userId], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ erro: 'Usuário não encontrado' });
    }
    res.json(user);
  });
});

// Rota de teste para verificar usuários
app.get('/api/testar', (req, res) => {
  db.all("SELECT id, nome, usuario, tipo FROM usuarios", [], (err, users) => {
    res.json({
      usuarios: users,
      mensagem: 'Sistema funcionando!'
    });
  });
});

// ========== ROTAS DE PÁGINAS ==========
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/src/pages/login.html'));
});

app.get('/garcom', (req, res) => {
  if (!req.session.userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, '../frontend/src/pages/garcom/dashboard-garcom.html'));
});

app.get('/cozinha', (req, res) => {
  if (!req.session.userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, '../frontend/src/pages/cozinha/tela-cozinha.html'));
});

app.get('/admin', (req, res) => {
  if (!req.session.userId) return res.redirect('/');
  res.sendFile(path.join(__dirname, '../frontend/src/pages/admin/painel-admin.html'));
});

// ========== INICIAR SERVIDOR ==========
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 SERVIDOR RODANDO NA PORTA ${PORT}`);
  console.log(`📱 Acesse: https://restaurante-sistema-0kyy.onrender.com`);
  console.log(`\n🔐 LOGINS:`);
  console.log(`   Admin:  admin / 123456`);
  console.log(`   Garçom: joao / 123456`);
  console.log(`   Cozinha: maria / 123456\n`);
});
