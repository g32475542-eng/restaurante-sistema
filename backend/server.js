const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const isProduction = process.env.NODE_ENV === "production";

const io = socketIO(server, {
  cors: {
    origin: isProduction
      ? "https://restaurante-sistema-4fy0.onrender.com"
      : true,
    credentials: true
  }
});

app.set("trust proxy", 1);

app.use(cors({
  origin: isProduction
    ? "https://restaurante-sistema-4fy0.onrender.com"
    : true,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "../frontend/src")));

const { Pool } = require("pg");

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction
    ? { rejectUnauthorized: false }
    : false
});

console.log("✅ PostgreSQL conectado");

app.use(session({
  store: new SQLiteStore({ db: "sessions.db" }),
  secret: process.env.SESSION_SECRET || "restaurante-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax"
  }
}));

async function query(sql, params = []) {
  const result = await db.query(sql, params);
  return result.rows;
}

async function criarTabelas() {

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
    CREATE TABLE IF NOT EXISTS mesas (
      id SERIAL PRIMARY KEY,
      numero INTEGER UNIQUE NOT NULL,
      status TEXT DEFAULT 'livre'
    )
  `);

  const users = await query("SELECT COUNT(*) FROM usuarios");

  if (Number(users[0].count) === 0) {

    const salt = bcrypt.genSaltSync(10);

    await query(
      "INSERT INTO usuarios (nome, usuario, senha, tipo) VALUES ($1,$2,$3,$4)",
      ["Administrador","admin",bcrypt.hashSync("123456",salt),"admin"]
    );

    await query(
      "INSERT INTO usuarios (nome, usuario, senha, tipo) VALUES ($1,$2,$3,$4)",
      ["Joao Garcom","joao",bcrypt.hashSync("123456",salt),"garcom"]
    );

    await query(
      "INSERT INTO usuarios (nome, usuario, senha, tipo) VALUES ($1,$2,$3,$4)",
      ["Maria Cozinha","maria",bcrypt.hashSync("123456",salt),"cozinha"]
    );

    console.log("✅ usuários padrão criados");
  }

  const mesas = await query("SELECT COUNT(*) FROM mesas");

  if (Number(mesas[0].count) === 0) {

    for (let i = 1; i <= 20; i++) {

      await query(
        "INSERT INTO mesas (numero,status) VALUES ($1,$2)",
        [i,"livre"]
      );

    }

    console.log("✅ mesas criadas");

  }

}

function auth(req,res,next){

  if(!req.session.userId){
    return res.redirect("/");
  }

  next();

}

app.post("/api/login", async (req,res)=>{

  const {usuario,senha} = req.body;

  if(!usuario || !senha){
    return res.status(400).json({erro:"Usuário e senha obrigatórios"});
  }

  try{

    const users = await query(
      "SELECT * FROM usuarios WHERE usuario=$1",
      [usuario]
    );

    const user = users[0];

    if(!user){
      return res.status(401).json({erro:"Usuário ou senha inválidos"});
    }

    const senhaOk = bcrypt.compareSync(senha,user.senha);

    if(!senhaOk){
      return res.status(401).json({erro:"Usuário ou senha inválidos"});
    }

    req.session.userId = user.id;
    req.session.userTipo = user.tipo;
    req.session.userNome = user.nome;

    console.log("✅ login:",user.usuario);

    res.json({
      sucesso:true,
      id:user.id,
      nome:user.nome,
      usuario:user.usuario,
      tipo:user.tipo
    });

  }catch(e){

    console.error(e);

    res.status(500).json({erro:"erro interno"});

  }

});

app.post("/api/logout",(req,res)=>{

  req.session.destroy(()=>{

    res.clearCookie("connect.sid");

    res.json({sucesso:true});

  });

});

app.get("/api/me", async (req,res)=>{

  if(!req.session.userId){
    return res.status(401).json({erro:"não autenticado"});
  }

  const users = await query(
    "SELECT id,nome,usuario,tipo FROM usuarios WHERE id=$1",
    [req.session.userId]
  );

  res.json(users[0]);

});

app.get("/",(req,res)=>{

  res.sendFile(
    path.join(__dirname,"../frontend/src/pages/login.html")
  );

});

app.get("/admin",auth,(req,res)=>{

  res.sendFile(
    path.join(__dirname,"../frontend/src/pages/admin/painel-admin.html")
  );

});

app.get("/garcom",auth,(req,res)=>{

  res.sendFile(
    path.join(__dirname,"../frontend/src/pages/garcom/dashboard-garcom.html")
  );

});

app.get("/cozinha",auth,(req,res)=>{

  res.sendFile(
    path.join(__dirname,"../frontend/src/pages/cozinha/tela-cozinha.html")
  );

});

const PORT = process.env.PORT || 3000;

criarTabelas().then(()=>{

  server.listen(PORT,()=>{

    console.log("\n🚀 servidor rodando");
    console.log("porta:",PORT);

    console.log("\nlogins:");

    console.log("admin / 123456");
    console.log("joao / 123456");
    console.log("maria / 123456");

  });

});
