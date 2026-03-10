const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

// Configuração do app
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, "../frontend/src")));

// Rotas
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/src/pages/login.html"));
});

app.get("/garcom/dashboard-garcom.html", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../frontend/src/pages/garcom/dashboard-garcom.html"),
  );
});

app.get("/cozinha/tela-cozinha.html", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../frontend/src/pages/cozinha/tela-cozinha.html"),
  );
});

app.get("/admin/painel-admin.html", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../frontend/src/pages/admin/painel-admin.html"),
  );
});

// ========== ARMAZENAMENTO DE PEDIDOS ==========
let pedidosPendentes = []; // Pedidos aguardando
let pedidosEmPreparo = []; // Pedidos sendo preparados
let pedidosProntos = []; // Pedidos prontos
let pedidosEntregues = []; // Histórico

// API para buscar pedidos (caso a cozinha entre depois)
app.get("/api/pedidos", (req, res) => {
  res.json({
    pendentes: pedidosPendentes,
    preparando: pedidosEmPreparo,
    prontos: pedidosProntos,
  });
});

// Socket.IO
io.on("connection", (socket) => {
  console.log("🔌 Novo cliente conectado:", socket.id);
  console.log("📊 Total de clientes conectados:", io.engine.clientsCount);

  // Quando a cozinha conecta, enviar todos os pedidos existentes
  socket.on("solicitar-pedidos", () => {
    console.log("📋 Cozinha solicitou pedidos existentes");
    socket.emit("carregar-pedidos", {
      pendentes: pedidosPendentes,
      preparando: pedidosEmPreparo,
      prontos: pedidosProntos,
    });
  });

  // Garçom enviou um novo pedido
  socket.on("novo-pedido", (pedido) => {
    console.log("📝 NOVO PEDIDO RECEBIDO:", pedido);

    // Adicionar timestamp e status inicial
    pedido.status = "pendente";
    pedido.timestamp = new Date();
    pedido.id = Date.now().toString();

    // Armazenar na lista de pendentes
    pedidosPendentes.push(pedido);

    console.log(
      `📦 Pedido armazenado. Total pendentes: ${pedidosPendentes.length}`,
    );

    // Enviar para TODOS os clientes conectados (cozinha e garçons)
    io.emit("pedido-para-cozinha", pedido);

    // Confirmar para o garçom
    socket.emit("pedido-confirmado", {
      mesa: pedido.mesa,
      mensagem: "Pedido enviado para cozinha!",
    });
  });

  // Cozinha começou a preparar
  socket.on("iniciar-preparo", (pedidoId) => {
    console.log("🔨 Iniciando preparo do pedido:", pedidoId);

    // Mover da lista de pendentes para preparando
    const index = pedidosPendentes.findIndex((p) => p.id === pedidoId);
    if (index !== -1) {
      const pedido = pedidosPendentes[index];
      pedido.status = "preparando";
      pedido.inicioPreparo = new Date();

      pedidosPendentes.splice(index, 1);
      pedidosEmPreparo.push(pedido);

      console.log(
        `✅ Pedido movido para preparo. Preparando: ${pedidosEmPreparo.length}`,
      );

      // Emitir para todos
      io.emit("pedido-em-preparo", pedidoId);
    }
  });

  // Cozinha finalizou o pedido
  socket.on("pedido-pronto", (pedido) => {
    console.log("✅ Pedido pronto:", pedido.id || pedido);

    let pedidoPronto;

    // Se veio o ID
    if (typeof pedido === "string") {
      const index = pedidosEmPreparo.findIndex((p) => p.id === pedido);
      if (index !== -1) {
        pedidoPronto = pedidosEmPreparo[index];
        pedidoPronto.status = "pronto";
        pedidoPronto.fimPreparo = new Date();

        pedidosEmPreparo.splice(index, 1);
        pedidosProntos.push(pedidoPronto);
      }
    } else {
      // Se veio o objeto completo
      pedido.status = "pronto";
      pedido.fimPreparo = new Date();

      // Remover de preparando se estiver lá
      const index = pedidosEmPreparo.findIndex((p) => p.id === pedido.id);
      if (index !== -1) {
        pedidosEmPreparo.splice(index, 1);
      }

      pedidosProntos.push(pedido);
      pedidoPronto = pedido;
    }

    if (pedidoPronto) {
      console.log(
        `✅ Pedido movido para pronto. Prontos: ${pedidosProntos.length}`,
      );
      io.emit("pedido-para-entrega", pedidoPronto);
    }
  });

  // Garçom entregou o pedido
  socket.on("pedido-entregue", (pedidoId) => {
    console.log("🍽️ Pedido entregue:", pedidoId);

    // Mover para entregues
    const index = pedidosProntos.findIndex((p) => p.id === pedidoId);
    if (index !== -1) {
      const pedido = pedidosProntos[index];
      pedido.status = "entregue";
      pedido.entrega = new Date();

      pedidosProntos.splice(index, 1);
      pedidosEntregues.push(pedido);

      console.log(
        `✅ Pedido entregue. Entregues hoje: ${pedidosEntregues.length}`,
      );
      io.emit("pedido-finalizado", pedidoId);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Cliente desconectado:", socket.id);
    console.log("📊 Clientes restantes:", io.engine.clientsCount);
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📱 Acesse: http://localhost:${PORT}`);
  console.log(
    `👨‍🍳 Garçom: http://localhost:${PORT}/garcom/dashboard-garcom.html`,
  );
  console.log(`👩‍🍳 Cozinha: http://localhost:${PORT}/cozinha/tela-cozinha.html`);
});
