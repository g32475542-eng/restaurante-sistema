const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

// ===== CONFIGURAÇÃO DO BANCO DE DADOS =====
const isProduction = process.env.NODE_ENV === 'production';

let db;
let pg;

if (isProduction) {
  // Em produção (Render): usar PostgreSQL
  const { Pool } = require('pg');
  pg = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  db = pg;
  console.log('✅ Conectado ao PostgreSQL (produção)');
} else {
  // Em desenvolvimento (local): usar SQLite
  const sqlite3 = require('sqlite3').verbose();
  db = new sqlite3.Database('./database/restaurante.db');
  console.log('✅ Conectado ao SQLite (desenvolvimento)');
}

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
    secure: isProduction
  }
}));

// ========== FUNÇÕES AUXILIARES PARA QUERIES ==========
async function query(sql, params = []) {
  if (isProduction) {
    const result = await db.query(sql, params);
    return result.rows;
  } else {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }
}

async function queryOne(sql, params = []) {
  if (isProduction) {
    const result = await db.query(sql, params);
    return result.rows[0];
  } else {
    return new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
}

async function run(sql, params = []) {
  if (isProduction) {
    const result = await db.query(sql, params);
    return { lastID: result.rows[0]?.id };
  } else {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID });
      });
    });
  }
}

// ========== CRIAR TABELAS ==========
async function criarTabelas() {
  if (isProduction) {
    // PostgreSQL
    await query(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        usuario TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        tipo TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS categorias (
        id SERIAL PRIMARY KEY,
        nome TEXT UNIQUE NOT NULL,
        icone TEXT DEFAULT '📋',
        cor TEXT DEFAULT '#4CAF50',
        ordem INTEGER DEFAULT 0,
        ativo INTEGER DEFAULT 1
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS cardapio (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        preco DECIMAL(10,2) NOT NULL,
        categoria_id INTEGER REFERENCES categorias(id),
        descricao TEXT,
        disponivel INTEGER DEFAULT 1,
        tempo_preparo INTEGER DEFAULT 15
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS mesas (
        id SERIAL PRIMARY KEY,
        numero INTEGER UNIQUE NOT NULL,
        status TEXT DEFAULT 'livre',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pedidos (
        id TEXT PRIMARY KEY,
        mesa_id INTEGER REFERENCES mesas(id),
        garcom_id INTEGER REFERENCES usuarios(id),
        total DECIMAL(10,2) DEFAULT 0,
        status TEXT DEFAULT 'pendente',
        observacao TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS pedido_itens (
        id SERIAL PRIMARY KEY,
        pedido_id TEXT REFERENCES pedidos(id),
        item_id INTEGER,
        nome TEXT NOT NULL,
        preco DECIMAL(10,2) NOT NULL,
        quantidade INTEGER DEFAULT 1,
        observacao TEXT,
        status TEXT DEFAULT 'pendente'
      )
    `);

    await query(`
      CREATE TABLE IF NOT EXISTS planos (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        preco DECIMAL(10,2) NOT NULL,
        max_restaurantes INTEGER DEFAULT 1,
        max_usuarios INTEGER DEFAULT 3,
        max_mesas INTEGER DEFAULT 10,
        recursos TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Tabelas PostgreSQL criadas');
  } else {
    // SQLite (código original simplificado)
    const sqlite3 = require('sqlite3').verbose();
    const dbLocal = new sqlite3.Database('./database/restaurante.db');
    
    dbLocal.serialize(() => {
      dbLocal.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        usuario TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        tipo TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      
      dbLocal.run(`CREATE TABLE IF NOT EXISTS categorias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT UNIQUE NOT NULL,
        icone TEXT DEFAULT '📋',
        cor TEXT DEFAULT '#4CAF50',
        ordem INTEGER DEFAULT 0,
        ativo INTEGER DEFAULT 1
      )`);
      
      dbLocal.run(`CREATE TABLE IF NOT EXISTS cardapio (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        preco REAL NOT NULL,
        categoria_id INTEGER,
        descricao TEXT,
        disponivel INTEGER DEFAULT 1,
        tempo_preparo INTEGER DEFAULT 15,
        FOREIGN KEY (categoria_id) REFERENCES categorias (id)
      )`);
      
      dbLocal.run(`CREATE TABLE IF NOT EXISTS mesas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero INTEGER UNIQUE NOT NULL,
        status TEXT DEFAULT 'livre',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
    });
    
    dbLocal.close();
    console.log('✅ Tabelas SQLite criadas');
  }

  await inserirDadosIniciais();
}

async function inserirDadosIniciais() {
  const salt = bcrypt.genSaltSync(10);

  // Verificar usuários
  const usuarios = await query("SELECT COUNT(*) as count FROM usuarios");
  
  if (usuarios[0].count === '0' || usuarios[0].count === 0) {
    const senhaAdmin = bcrypt.hashSync('123456', salt);
    const senhaJoao = bcrypt.hashSync('123456', salt);
    const senhaMaria = bcrypt.hashSync('123456', salt);

    if (isProduction) {
      await run(
        "INSERT INTO usuarios (nome, usuario, senha, tipo) VALUES ($1, $2, $3, $4)",
        ['Administrador', 'admin', senhaAdmin, 'admin']
      );
      await run(
        "INSERT INTO usuarios (nome, usuario, senha, tipo) VALUES ($1, $2, $3, $4)",
        ['João Garçom', 'joao', senhaJoao, 'garcom']
      );
      await run(
        "INSERT INTO usuarios (nome, usuario, senha, tipo) VALUES ($1, $2, $3, $4)",
        ['Maria Cozinha', 'maria', senhaMaria, 'cozinha']
      );
    } else {
      const dbLocal = new (require('sqlite3').verbose()).Database('./database/restaurante.db');
      dbLocal.run("INSERT INTO usuarios (nome, usuario, senha, tipo) VALUES (?, ?, ?, ?)",
        ['Administrador', 'admin', senhaAdmin, 'admin']);
      dbLocal.run("INSERT INTO usuarios (nome, usuario, senha, tipo) VALUES (?, ?, ?, ?)",
        ['João Garçom', 'joao', senhaJoao, 'garcom']);
      dbLocal.run("INSERT INTO usuarios (nome, usuario, senha, tipo) VALUES (?, ?, ?, ?)",
        ['Maria Cozinha', 'maria', senhaMaria, 'cozinha']);
      dbLocal.close();
    }
    console.log('✅ Usuários padrão criados');
  }

  // Verificar planos
  const planos = await query("SELECT COUNT(*) as count FROM planos");
  
  if (planos[0].count === '0' || planos[0].count === 0) {
    if (isProduction) {
      await run(
        "INSERT INTO planos (nome, preco, max_restaurantes, max_usuarios, max_mesas) VALUES ($1, $2, $3, $4, $5)",
        ['Limitado', 97.00, 1, 3, 10]
      );
      await run(
        "INSERT INTO planos (nome, preco, max_restaurantes, max_usuarios, max_mesas) VALUES ($1, $2, $3, $4, $5)",
        ['Profissional', 197.00, 3, 10, 30]
      );
    }
    console.log('✅ Planos criados');
  }

  // Verificar categorias
  const categorias = await query("SELECT COUNT(*) as count FROM categorias");
  
  if (categorias[0].count === '0' || categorias[0].count === 0) {
    const cats = [
      ['Entradas', '🥗', '#4CAF50', 1],
      ['Pratos', '🍽️', '#FF5722', 2],
      ['Bebidas', '🥤', '#2196F3', 3],
      ['Sobremesas', '🍰', '#9C27B0', 4]
    ];
    
    for (const cat of cats) {
      if (isProduction) {
        await run(
          "INSERT INTO categorias (nome, icone, cor, ordem) VALUES ($1, $2, $3, $4)",
          cat
        );
      }
    }
    console.log('✅ Categorias criadas');
  }

  // Verificar mesas
  const mesas = await query("SELECT COUNT(*) as count FROM mesas");
  
  if (mesas[0].count === '0' || mesas[0].count === 0) {
    for (let i = 1; i <= 20; i++) {
      if (isProduction) {
        await run(
          "INSERT INTO mesas (numero, status) VALUES ($1, $2)",
          [i, 'livre']
        );
      }
    }
    console.log('✅ Mesas criadas');
  }
}

// ========== ROTAS DE AUTENTICAÇÃO ==========
app.post('/api/login', async (req, res) => {
  const { usuario, senha } = req.body;
  
  try {
    const users = await query("SELECT * FROM usuarios WHERE usuario = $1", [usuario]);
    const user = users[0];
    
    if (!user || !bcrypt.compareSync(senha, user.senha)) {
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
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }
  
  try {
    const users = await query(
      "SELECT id, nome, usuario, tipo FROM usuarios WHERE id = $1", 
      [req.session.userId]
    );
    
    if (!users[0]) {
      return res.status(401).json({ erro: 'Usuário não encontrado' });
    }
    
    res.json(users[0]);
  } catch (error) {
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// ========== ROTAS DE CATEGORIAS ==========
app.get('/api/categorias', async (req, res) => {
  try {
    const categorias = await query("SELECT * FROM categorias ORDER BY ordem, nome");
    res.json(categorias);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar categorias' });
  }
});

app.post('/api/categorias', async (req, res) => {
  const { nome, icone, cor, ordem } = req.body;
  
  if (!nome) {
    return res.status(400).json({ erro: 'Nome é obrigatório' });
  }
  
  try {
    const result = await run(
      "INSERT INTO categorias (nome, icone, cor, ordem) VALUES ($1, $2, $3, $4) RETURNING id",
      [nome, icone || '📋', cor || '#4CAF50', ordem || 0]
    );
    
    res.json({ id: result.lastID, nome, icone, cor, ordem });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar categoria' });
  }
});

app.put('/api/categorias/:id', async (req, res) => {
  const { nome, icone, cor, ordem, ativo } = req.body;
  const { id } = req.params;
  
  try {
    await run(
      "UPDATE categorias SET nome = $1, icone = $2, cor = $3, ordem = $4, ativo = $5 WHERE id = $6",
      [nome, icone, cor, ordem, ativo, id]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar categoria' });
  }
});

app.delete('/api/categorias/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    await run("DELETE FROM categorias WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao deletar categoria' });
  }
});

// ========== ROTAS DO CARDÁPIO ==========
app.get('/api/cardapio', async (req, res) => {
  try {
    const itens = await query(`
      SELECT c.*, cat.nome as categoria_nome, cat.cor as categoria_cor, cat.icone as categoria_icone
      FROM cardapio c
      LEFT JOIN categorias cat ON c.categoria_id = cat.id
      ORDER BY cat.ordem, c.nome
    `);
    res.json(itens);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar cardápio' });
  }
});

app.post('/api/cardapio', async (req, res) => {
  const { nome, preco, categoria_id, descricao, tempo_preparo } = req.body;
  
  if (!nome || !preco || !categoria_id) {
    return res.status(400).json({ erro: 'Nome, preço e categoria são obrigatórios' });
  }
  
  try {
    const result = await run(
      "INSERT INTO cardapio (nome, preco, categoria_id, descricao, tempo_preparo) VALUES ($1, $2, $3, $4, $5) RETURNING id",
      [nome, preco, categoria_id, descricao || '', tempo_preparo || 15]
    );
    res.json({ id: result.lastID, nome, preco, categoria_id, descricao, tempo_preparo });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar item' });
  }
});

app.put('/api/cardapio/:id', async (req, res) => {
  const { nome, preco, categoria_id, descricao, disponivel, tempo_preparo } = req.body;
  const { id } = req.params;
  
  try {
    await run(
      "UPDATE cardapio SET nome = $1, preco = $2, categoria_id = $3, descricao = $4, disponivel = $5, tempo_preparo = $6 WHERE id = $7",
      [nome, preco, categoria_id, descricao, disponivel, tempo_preparo, id]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar item' });
  }
});

app.delete('/api/cardapio/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    await run("DELETE FROM cardapio WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao deletar item' });
  }
});

// ========== ROTAS DE MESAS ==========
app.get('/api/mesas', async (req, res) => {
  try {
    const mesas = await query("SELECT * FROM mesas ORDER BY numero");
    res.json(mesas);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar mesas' });
  }
});

app.post('/api/mesas', async (req, res) => {
  const { numero } = req.body;
  
  if (!numero) {
    return res.status(400).json({ erro: 'Número da mesa é obrigatório' });
  }
  
  try {
    const result = await run(
      "INSERT INTO mesas (numero) VALUES ($1) RETURNING id",
      [numero]
    );
    res.json({ id: result.lastID, numero, status: 'livre' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar mesa' });
  }
});

app.put('/api/mesas/:id', async (req, res) => {
  const { numero, status } = req.body;
  const { id } = req.params;
  
  try {
    await run(
      "UPDATE mesas SET numero = $1, status = $2 WHERE id = $3",
      [numero, status, id]
    );
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar mesa' });
  }
});

app.delete('/api/mesas/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    await run("DELETE FROM mesas WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao deletar mesa' });
  }
});

// ========== ROTAS DE USUÁRIOS ==========
app.get('/api/usuarios', async (req, res) => {
  try {
    const usuarios = await query(
      "SELECT id, nome, usuario, tipo, created_at FROM usuarios ORDER BY id"
    );
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar usuários' });
  }
});

app.post('/api/usuarios', async (req, res) => {
  const { nome, usuario, senha, tipo } = req.body;
  
  if (!nome || !usuario || !senha || !tipo) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
  }
  
  try {
    const senhaHash = bcrypt.hashSync(senha, 10);
    const result = await run(
      "INSERT INTO usuarios (nome, usuario, senha, tipo) VALUES ($1, $2, $3, $4) RETURNING id",
      [nome, usuario, senhaHash, tipo]
    );
    
    res.json({ id: result.lastID, nome, usuario, tipo });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar usuário' });
  }
});

app.put('/api/usuarios/:id', async (req, res) => {
  const { nome, usuario, senha, tipo } = req.body;
  const { id } = req.params;
  
  try {
    if (senha) {
      const senhaHash = bcrypt.hashSync(senha, 10);
      await run(
        "UPDATE usuarios SET nome = $1, usuario = $2, senha = $3, tipo = $4 WHERE id = $5",
        [nome, usuario, senhaHash, tipo, id]
      );
    } else {
      await run(
        "UPDATE usuarios SET nome = $1, usuario = $2, tipo = $3 WHERE id = $4",
        [nome, usuario, tipo, id]
      );
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar usuário' });
  }
});

app.delete('/api/usuarios/:id', async (req, res) => {
  const { id } = req.params;
  
  if (id === '1') {
    return res.status(400).json({ erro: 'Não é possível excluir o administrador principal' });
  }
  
  try {
    await run("DELETE FROM usuarios WHERE id = $1", [id]);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao deletar usuário' });
  }
});

// ========== ROTAS DE PLANOS ==========
app.get('/api/planos', async (req, res) => {
  try {
    const planos = await query("SELECT * FROM planos ORDER BY preco");
    res.json(planos);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar planos' });
  }
});

// ========== ROTAS DE PEDIDOS ==========
app.post('/api/pedidos', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }
  
  const pedido = req.body;
  const pedidoId = Date.now().toString();
  
  try {
    await run(
      "INSERT INTO pedidos (id, mesa_id, garcom_id, total, observacao) VALUES ($1, $2, $3, $4, $5)",
      [pedidoId, pedido.mesa, req.session.userId, pedido.total, pedido.observacao || '']
    );
    
    for (const item of pedido.itens) {
      await run(
        "INSERT INTO pedido_itens (pedido_id, item_id, nome, preco, quantidade, observacao) VALUES ($1, $2, $3, $4, $5, $6)",
        [pedidoId, item.id, item.nome, item.preco, item.quantidade, item.observacao || '']
      );
    }
    
    await run("UPDATE mesas SET status = 'ocupada' WHERE id = $1", [pedido.mesa]);
    
    io.emit('novo-pedido', { ...pedido, id: pedidoId, created_at: new Date() });
    
    res.json({ id: pedidoId, ok: true });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar pedido' });
  }
});

app.get('/api/pedidos/pendentes', async (req, res) => {
  try {
    const pedidos = await query(`
      SELECT p.*, m.numero as mesa_numero, u.nome as garcom_nome
      FROM pedidos p
      JOIN mesas m ON p.mesa_id = m.id
      LEFT JOIN usuarios u ON p.garcom_id = u.id
      WHERE p.status IN ('pendente', 'preparando')
      ORDER BY p.created_at DESC
    `);
    res.json(pedidos);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar pedidos' });
  }
});

app.get('/api/pedidos/prontos', async (req, res) => {
  try {
    const pedidos = await query(`
      SELECT p.*, m.numero as mesa_numero
      FROM pedidos p
      JOIN mesas m ON p.mesa_id = m.id
      WHERE p.status = 'pronto'
      ORDER BY p.created_at DESC
    `);
    res.json(pedidos);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar pedidos' });
  }
});

app.post('/api/pedidos/:id/entregar', async (req, res) => {
  const pedidoId = req.params.id;
  
  try {
    await run("UPDATE pedidos SET status = 'entregue', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [pedidoId]);
    
    const result = await query("SELECT mesa_id FROM pedidos WHERE id = $1", [pedidoId]);
    if (result[0]) {
      await run("UPDATE mesas SET status = 'livre' WHERE id = $1", [result[0].mesa_id]);
    }
    
    io.emit('pedido-entregue', pedidoId);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao entregar pedido' });
  }
});

// ========== ROTAS DE ESTATÍSTICAS ==========
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(*) as total_pedidos,
        COALESCE(SUM(total), 0) as faturamento,
        COUNT(DISTINCT mesa_id) as clientes
      FROM pedidos 
      WHERE DATE(created_at) = CURRENT_DATE
    `);
    
    res.json({
      faturamento: stats[0]?.faturamento || 0,
      pedidos: stats[0]?.total_pedidos || 0,
      clientes: stats[0]?.clientes || 0,
      tempoMedio: 30
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar estatísticas' });
  }
});

// ========== ROTAS DE CONFIGURAÇÕES ==========
app.get('/api/config', async (req, res) => {
  try {
    const configs = await query("SELECT chave, valor FROM configuracoes");
    
    const config = {};
    configs.forEach(row => {
      config[row.chave] = row.valor;
    });
    
    res.json(config);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar configurações' });
  }
});

// ========== SOCKET.IO ==========
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);

  socket.on('solicitar-pedidos', async () => {
    try {
      const pedidos = await query(`
        SELECT * FROM pedidos 
        WHERE status IN ('pendente', 'preparando', 'pronto') 
        ORDER BY created_at DESC
      `);
      socket.emit('pedidos-ativos', pedidos);
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
    }
  });

  socket.on('iniciar-preparo', async (pedidoId) => {
    console.log('🔨 Iniciar preparo:', pedidoId);
    try {
      await run("UPDATE pedidos SET status = 'preparando', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [pedidoId]);
      io.emit('pedido-em-preparo', pedidoId);
    } catch (error) {
      console.error('Erro ao iniciar preparo:', error);
    }
  });

  socket.on('pedido-pronto', async (pedidoId) => {
    console.log('✅ Pedido pronto:', pedidoId);
    try {
      await run("UPDATE pedidos SET status = 'pronto', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [pedidoId]);
      io.emit('pedido-para-entrega', pedidoId);
    } catch (error) {
      console.error('Erro ao finalizar preparo:', error);
    }
  });
});

// ========== ROTAS DE PÁGINAS ==========
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/src/pages/login.html'));
});

app.get('/admin', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, '../frontend/src/pages/admin/painel-admin.html'));
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

// ========== INICIAR SERVIDOR ==========
const PORT = process.env.PORT || 3000;

criarTabelas().then(() => {
  server.listen(PORT, () => {
    console.log(`\n🚀 SERVIDOR RODANDO NA PORTA ${PORT}`);
    console.log(`📱 Local: http://localhost:${PORT}`);
    if (isProduction) {
      console.log(`🌐 Render: https://restaurante-sistema-4fy0.onrender.com`);
    }
    console.log(`\n🔐 LOGINS:`);
    console.log(`   Admin: admin / 123456`);
    console.log(`   Garçom: joao / 123456`);
    console.log(`   Cozinha: maria / 123456\n`);
  });
});
