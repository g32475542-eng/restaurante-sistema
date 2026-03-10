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

  // Tabela de configurações
  db.run(`CREATE TABLE IF NOT EXISTS configuracoes (
    chave TEXT PRIMARY KEY,
    valor TEXT,
    tipo TEXT DEFAULT 'texto'
  )`);

  // Limpar e recriar usuários (garantia)
  db.run("DELETE FROM usuarios");
  
  // Inserir usuários
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

  // Inserir categorias
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

  // Configurações padrão
  db.get("SELECT COUNT(*) as count FROM configuracoes", (err, row) => {
    if (row.count === 0) {
      const configs = [
        ['nome_restaurante', 'Meu Restaurante'],
        ['tempo_medio', '30'],
        ['cor_primaria', '#4CAF50'],
        ['cor_secundaria', '#FF9800']
      ];
      configs.forEach(cfg => {
        db.run("INSERT INTO configuracoes (chave, valor) VALUES (?, ?)", cfg);
      });
    }
  });

  console.log('✅ Banco de dados inicializado com sucesso!');
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

// ========== ROTAS DE AUTENTICAÇÃO ==========
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

app.post('/api/mesas', verificarAdmin, (req, res) => {
  const { numero } = req.body;
  
  if (!numero) {
    return res.status(400).json({ erro: 'Número da mesa é obrigatório' });
  }
  
  db.run("INSERT INTO mesas (numero) VALUES (?)", [numero], function(err) {
    if (err) {
      console.error('Erro ao criar mesa:', err);
      return res.status(500).json({ erro: 'Erro ao criar mesa' });
    }
    res.json({ id: this.lastID, numero, status: 'livre' });
  });
});

app.put('/api/mesas/:id', verificarAdmin, (req, res) => {
  const { numero, status } = req.body;
  
  db.run("UPDATE mesas SET numero = ?, status = ? WHERE id = ?",
    [numero, status, req.params.id], function(err) {
    if (err) {
      console.error('Erro ao atualizar mesa:', err);
      return res.status(500).json({ erro: 'Erro ao atualizar mesa' });
    }
    res.json({ ok: true });
  });
});

app.delete('/api/mesas/:id', verificarAdmin, (req, res) => {
  db.run("DELETE FROM mesas WHERE id = ?", [req.params.id], function(err) {
    if (err) {
      console.error('Erro ao deletar mesa:', err);
      return res.status(500).json({ erro: 'Erro ao deletar mesa' });
    }
    res.json({ ok: true });
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

app.put('/api/categorias/:id', verificarAdmin, (req, res) => {
  const { nome, icone, cor, ordem, ativo } = req.body;
  
  db.run(
    "UPDATE categorias SET nome = ?, icone = ?, cor = ?, ordem = ?, ativo = ? WHERE id = ?",
    [nome, icone, cor, ordem, ativo, req.params.id],
    function(err) {
      if (err) {
        console.error('Erro ao atualizar categoria:', err);
        return res.status(500).json({ erro: 'Erro ao atualizar categoria' });
      }
      res.json({ ok: true });
    }
  );
});

app.delete('/api/categorias/:id', verificarAdmin, (req, res) => {
  db.run("DELETE FROM categorias WHERE id = ?", [req.params.id], function(err) {
    if (err) {
      console.error('Erro ao deletar categoria:', err);
      return res.status(500).json({ erro: 'Erro ao deletar categoria' });
    }
    res.json({ ok: true });
  });
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

app.post('/api/cardapio', verificarAdmin, (req, res) => {
  const { nome, preco, categoria_id, descricao, tempo_preparo } = req.body;
  
  if (!nome || !preco || !categoria_id) {
    return res.status(400).json({ erro: 'Nome, preço e categoria são obrigatórios' });
  }
  
  db.run(
    "INSERT INTO cardapio (nome, preco, categoria_id, descricao, tempo_preparo) VALUES (?, ?, ?, ?, ?)",
    [nome, preco, categoria_id, descricao || '', tempo_preparo || 15],
    function(err) {
      if (err) {
        console.error('Erro ao criar item:', err);
        return res.status(500).json({ erro: 'Erro ao criar item' });
      }
      res.json({ id: this.lastID, ...req.body });
    }
  );
});

app.put('/api/cardapio/:id', verificarAdmin, (req, res) => {
  const { nome, preco, categoria_id, descricao, disponivel, tempo_preparo } = req.body;
  
  db.run(
    "UPDATE cardapio SET nome = ?, preco = ?, categoria_id = ?, descricao = ?, disponivel = ?, tempo_preparo = ? WHERE id = ?",
    [nome, preco, categoria_id, descricao, disponivel, tempo_preparo, req.params.id],
    function(err) {
      if (err) {
        console.error('Erro ao atualizar item:', err);
        return res.status(500).json({ erro: 'Erro ao atualizar item' });
      }
      res.json({ ok: true });
    }
  );
});

app.delete('/api/cardapio/:id', verificarAdmin, (req, res) => {
  db.run("DELETE FROM cardapio WHERE id = ?", [req.params.id], function(err) {
    if (err) {
      console.error('Erro ao deletar item:', err);
      return res.status(500).json({ erro: 'Erro ao deletar item' });
    }
    res.json({ ok: true });
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

app.post('/api/usuarios', verificarAdmin, (req, res) => {
  const { nome, usuario, senha, tipo } = req.body;
  
  if (!nome || !usuario || !senha || !tipo) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
  }
  
  const senhaHash = bcrypt.hashSync(senha, 10);
  
  db.run(
    "INSERT INTO usuarios (nome, usuario, senha, tipo) VALUES (?, ?, ?, ?)",
    [nome, usuario, senhaHash, tipo],
    function(err) {
      if (err) {
        console.error('Erro ao criar usuário:', err);
        return res.status(500).json({ erro: 'Erro ao criar usuário' });
      }
      res.json({ id: this.lastID, nome, usuario, tipo });
    }
  );
});

app.put('/api/usuarios/:id', verificarAdmin, (req, res) => {
  const { nome, usuario, senha, tipo } = req.body;
  const id = req.params.id;
  
  let query, params;
  
  if (senha) {
    const senhaHash = bcrypt.hashSync(senha, 10);
    query = "UPDATE usuarios SET nome = ?, usuario = ?, senha = ?, tipo = ? WHERE id = ?";
    params = [nome, usuario, senhaHash, tipo, id];
  } else {
    query = "UPDATE usuarios SET nome = ?, usuario = ?, tipo = ? WHERE id = ?";
    params = [nome, usuario, tipo, id];
  }
  
  db.run(query, params, function(err) {
    if (err) {
      console.error('Erro ao atualizar usuário:', err);
      return res.status(500).json({ erro: 'Erro ao atualizar usuário' });
    }
    res.json({ ok: true });
  });
});

app.delete('/api/usuarios/:id', verificarAdmin, (req, res) => {
  if (req.params.id === '1') {
    return res.status(400).json({ erro: 'Não é possível excluir o administrador principal' });
  }
  
  db.run("DELETE FROM usuarios WHERE id = ?", [req.params.id], function(err) {
    if (err) {
      console.error('Erro ao deletar usuário:', err);
      return res.status(500).json({ erro: 'Erro ao deletar usuário' });
    }
    res.json({ ok: true });
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
      
      const stmt = db.prepare(
        "INSERT INTO pedido_itens (pedido_id, item_id, nome, preco, quantidade, observacao) VALUES (?, ?, ?, ?, ?, ?)"
      );
      
      pedido.itens.forEach(item => {
        stmt.run([pedidoId, item.id, item.nome, item.preco, item.quantidade, item.observacao || '']);
      });
      
      stmt.finalize();
      
      db.run("UPDATE mesas SET status = 'ocupada' WHERE id = ?", [pedido.mesa]);
      
      io.emit('novo-pedido', { ...pedido, id: pedidoId, created_at: new Date() });
      
      res.json({ id: pedidoId, ok: true });
    }
  );
});

app.get('/api/pedidos/pendentes', (req, res) => {
  db.all(`
    SELECT p.*, m.numero as mesa_numero, u.nome as garcom_nome
    FROM pedidos p
    JOIN mesas m ON p.mesa_id = m.id
    LEFT JOIN usuarios u ON p.garcom_id = u.id
    WHERE p.status IN ('pendente', 'preparando')
    ORDER BY p.created_at DESC
  `, [], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar pedidos:', err);
      return res.status(500).json({ erro: 'Erro ao buscar pedidos' });
    }
    res.json(rows);
  });
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

app.post('/api/pedidos/:id/entregar', (req, res) => {
  const pedidoId = req.params.id;
  
  db.run("UPDATE pedidos SET status = 'entregue', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [pedidoId], function(err) {
    if (err) {
      console.error('Erro ao entregar pedido:', err);
      return res.status(500).json({ erro: 'Erro ao entregar pedido' });
    }
    
    db.get("SELECT mesa_id FROM pedidos WHERE id = ?", [pedidoId], (err, row) => {
      if (row) {
        db.run("UPDATE mesas SET status = 'livre' WHERE id = ?", [row.mesa_id]);
      }
    });
    
    io.emit('pedido-entregue', pedidoId);
    res.json({ ok: true });
  });
});

// ========== ROTAS DE ESTATÍSTICAS ==========
app.get('/api/stats', verificarAdmin, (req, res) => {
  db.all(`
    SELECT 
      COUNT(*) as total_pedidos,
      SUM(total) as faturamento,
      COUNT(DISTINCT mesa_id) as clientes
    FROM pedidos 
    WHERE date(created_at) = date('now')
  `, [], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar stats:', err);
      return res.status(500).json({ erro: 'Erro ao buscar estatísticas' });
    }
    
    res.json({
      faturamento: rows[0]?.faturamento || 0,
      pedidos: rows[0]?.total_pedidos || 0,
      clientes: rows[0]?.clientes || 0,
      tempoMedio: 30
    });
  });
});

// ========== ROTAS DE CONFIGURAÇÕES ==========
app.get('/api/config', (req, res) => {
  db.all("SELECT chave, valor FROM configuracoes", [], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar config:', err);
      return res.status(500).json({ erro: 'Erro ao buscar configurações' });
    }
    
    const config = {};
    rows.forEach(row => {
      config[row.chave] = row.valor;
    });
    
    res.json(config);
  });
});

app.post('/api/config', verificarAdmin, (req, res) => {
  const configs = req.body;
  
  const stmt = db.prepare("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES (?, ?)");
  
  Object.entries(configs).forEach(([chave, valor]) => {
    stmt.run([chave, valor.toString()]);
  });
  
  stmt.finalize();
  res.json({ ok: true });
});

// ========== ROTA DE TESTE ==========
app.get('/api/testar', (req, res) => {
  db.all("SELECT id, nome, usuario, tipo FROM usuarios", [], (err, users) => {
    res.json({
      usuarios: users,
      mensagem: 'Sistema funcionando!'
    });
  });
});

// ========== SOCKET.IO ==========
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);

  socket.on('solicitar-pedidos', () => {
    db.all("SELECT * FROM pedidos WHERE status IN ('pendente', 'preparando', 'pronto') ORDER BY created_at DESC", 
    [], (err, rows) => {
      if (!err) {
        socket.emit('pedidos-ativos', rows);
      }
    });
  });

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
