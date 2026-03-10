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
// Garantir que a pasta database existe
const dbDir = path.join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log('📁 Pasta database criada em:', dbDir);
}

const dbPath = path.join(dbDir, 'restaurante.db');
console.log('📁 Caminho do banco:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Erro no banco:', err);
    console.error('📁 Caminho tentado:', dbPath);
  } else {
    console.log('✅ Banco de dados conectado em:', dbPath);
    criarTabelas();
  }
});

function criarTabelas() {
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

  // Tabela de itens do cardápio
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

  // Tabela de pedidos
  db.run(`CREATE TABLE IF NOT EXISTS pedidos (
    id TEXT PRIMARY KEY,
    mesa_id INTEGER,
    garcom_id INTEGER,
    total REAL DEFAULT 0,
    status TEXT DEFAULT 'pendente',
    observacao TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME,
    FOREIGN KEY (mesa_id) REFERENCES mesas (id),
    FOREIGN KEY (garcom_id) REFERENCES usuarios (id)
  )`);

  // Tabela de itens do pedido
  db.run(`CREATE TABLE IF NOT EXISTS pedido_itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id TEXT,
    item_id INTEGER,
    nome TEXT NOT NULL,
    preco REAL NOT NULL,
    quantidade INTEGER DEFAULT 1,
    observacao TEXT,
    status TEXT DEFAULT 'pendente',
    FOREIGN KEY (pedido_id) REFERENCES pedidos (id)
  )`);

  console.log('✅ Tabelas criadas/verificadas');

  // Inserir dados iniciais
  inserirDadosIniciais();
}

function inserirDadosIniciais() {
  // Usuários padrão
  db.get("SELECT COUNT(*) as count FROM usuarios", (err, row) => {
    if (row.count === 0) {
      const senhaAdmin = bcrypt.hashSync('123456', 10);
      db.run("INSERT INTO usuarios (nome, usuario, senha, tipo) VALUES (?, ?, ?, ?)",
        ['Administrador', 'admin', senhaAdmin, 'admin']);
      db.run("INSERT INTO usuarios (nome, usuario, senha, tipo) VALUES (?, ?, ?, ?)",
        ['João Garçom', 'joao', bcrypt.hashSync('123456', 10), 'garcom']);
      db.run("INSERT INTO usuarios (nome, usuario, senha, tipo) VALUES (?, ?, ?, ?)",
        ['Maria Cozinha', 'maria', bcrypt.hashSync('123456', 10), 'cozinha']);
      console.log('✅ Usuários padrão criados');
    }
  });

  // Categorias padrão
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
      console.log('✅ Categorias padrão criadas');
    }
  });

  // Mesas padrão
  db.get("SELECT COUNT(*) as count FROM mesas", (err, row) => {
    if (row.count === 0) {
      for (let i = 1; i <= 20; i++) {
        db.run("INSERT INTO mesas (numero, status) VALUES (?, ?)", [i, 'livre']);
      }
      console.log('✅ Mesas padrão criadas');
    }
  });
}

// ========== ROTAS DE AUTENTICAÇÃO ==========
app.post('/api/login', (req, res) => {
  const { usuario, senha } = req.body;
  
  if (!usuario || !senha) {
    return res.status(400).json({ erro: 'Usuário e senha são obrigatórios' });
  }
  
  db.get("SELECT * FROM usuarios WHERE usuario = ?", [usuario], (err, user) => {
    if (err) {
      console.error('Erro no banco:', err);
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
    
    if (!user) {
      return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
    }
    
    const senhaValida = bcrypt.compareSync(senha, user.senha);
    
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Usuário ou senha inválidos' });
    }
    
    req.session.userId = user.id;
    req.session.userTipo = user.tipo;
    req.session.userNome = user.nome;
    
    console.log(`✅ Login: ${user.nome} (${user.tipo})`);
    
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

// ========== ROTAS DE CATEGORIAS ==========
app.get('/api/categorias', (req, res) => {
  db.all("SELECT * FROM categorias ORDER BY ordem, nome", [], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar categorias:', err);
      return res.status(500).json({ erro: 'Erro ao buscar categorias' });
    }
    res.json(rows);
  });
});

app.post('/api/categorias', verificarAdmin, (req, res) => {
  const { nome, icone, cor, ordem } = req.body;
  
  if (!nome) {
    return res.status(400).json({ erro: 'Nome é obrigatório' });
  }
  
  db.run(
    "INSERT INTO categorias (nome, icone, cor, ordem) VALUES (?, ?, ?, ?)",
    [nome, icone || '📋', cor || '#4CAF50', ordem || 0],
    function(err) {
      if (err) {
        console.error('Erro ao criar categoria:', err);
        return res.status(500).json({ erro: 'Erro ao criar categoria' });
      }
      res.json({ id: this.lastID, nome, icone, cor, ordem });
    }
  );
});

// ========== ROTAS DO CARDÁPIO ==========
app.get('/api/cardapio', (req, res) => {
  db.all(`
    SELECT c.*, cat.nome as categoria_nome, cat.cor as categoria_cor, cat.icone as categoria_icone
    FROM cardapio c
    LEFT JOIN categorias cat ON c.categoria_id = cat.id
    ORDER BY cat.ordem, c.nome
  `, [], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar cardápio:', err);
      return res.status(500).json({ erro: 'Erro ao buscar cardápio' });
    }
    res.json(rows);
  });
});

// ========== ROTAS DE MESAS ==========
app.get('/api/mesas', (req, res) => {
  db.all("SELECT * FROM mesas ORDER BY numero", [], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar mesas:', err);
      return res.status(500).json({ erro: 'Erro ao buscar mesas' });
    }
    res.json(rows);
  });
});

// ========== ROTAS DE USUÁRIOS ==========
app.get('/api/usuarios', verificarAdmin, (req, res) => {
  db.all("SELECT id, nome, usuario, tipo, created_at FROM usuarios ORDER BY id", [], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar usuários:', err);
      return res.status(500).json({ erro: 'Erro ao buscar usuários' });
    }
    res.json(rows);
  });
});

// ========== ROTAS DE PEDIDOS ==========
app.post('/api/pedidos', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }
  
  const pedido = req.body;
  const pedidoId = Date.now().toString();
  
  db.run(
    "INSERT INTO pedidos (id, mesa_id, garcom_id, total, observacao) VALUES (?, ?, ?, ?, ?)",
    [pedidoId, pedido.mesa, req.session.userId, pedido.total, pedido.observacao || ''],
    function(err) {
      if (err) {
        console.error('Erro ao criar pedido:', err);
        return res.status(500).json({ erro: 'Erro ao criar pedido' });
      }
      
      // Inserir itens do pedido
      const stmt = db.prepare(
        "INSERT INTO pedido_itens (pedido_id, item_id, nome, preco, quantidade, observacao) VALUES (?, ?, ?, ?, ?, ?)"
      );
      
      pedido.itens.forEach(item => {
        stmt.run([pedidoId, item.id, item.nome, item.preco, item.quantidade, item.observacao || '']);
      });
      
      stmt.finalize();
      
      // Atualizar status da mesa
      db.run("UPDATE mesas SET status = 'ocupada' WHERE id = ?", [pedido.mesa]);
      
      // Emitir via socket
      io.emit('novo-pedido', { ...pedido, id: pedidoId });
      
      res.json({ id: pedidoId, ok: true });
    }
  );
});

app.get('/api/pedidos/prontos', (req, res) => {
  db.all(`
    SELECT p.*, m.numero as mesa_numero
    FROM pedidos p
    JOIN mesas m ON p.mesa_id = m.id
    WHERE p.status = 'pronto'
    ORDER BY p.created_at DESC
  `, [], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar pedidos prontos:', err);
      return res.status(500).json({ erro: 'Erro ao buscar pedidos' });
    }
    res.json(rows);
  });
});

// ========== MIDDLEWARE DE ADMIN ==========
function verificarAdmin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }
  
  db.get("SELECT tipo FROM usuarios WHERE id = ?", [req.session.userId], (err, user) => {
    if (err || !user || user.tipo !== 'admin') {
      return res.status(403).json({ erro: 'Acesso negado' });
    }
    next();
  });
}

// ========== SOCKET.IO ==========
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);

  socket.on('iniciar-preparo', (pedidoId) => {
    console.log('🔨 Iniciar preparo:', pedidoId);
    db.run("UPDATE pedidos SET status = 'preparando', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [pedidoId]);
    io.emit('pedido-em-preparo', pedidoId);
  });

  socket.on('pedido-pronto', (pedidoId) => {
    console.log('✅ Pedido pronto:', pedidoId);
    db.run("UPDATE pedidos SET status = 'pronto', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [pedidoId]);
    io.emit('pedido-para-entrega', pedidoId);
  });
});

// ========== ROTAS DE PÁGINAS ==========
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/src/pages/login.html'));
});

app.get('/garcom', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, '../frontend/src/pages/garcom/dashboard-garcom.html'));
});

app.get('/cozinha', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, '../frontend/src/pages/cozinha/tela-cozinha.html'));
});

app.get('/admin', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, '../frontend/src/pages/admin/painel-admin.html'));
});

// ========== INICIAR SERVIDOR ==========
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🚀 SERVIDOR RODANDO NA PORTA ${PORT}`);
  console.log(`📱 Local: http://localhost:${PORT}`);
  console.log(`🌐 Render: https://restaurante-sistema-0kyy.onrender.com\n`);
});
