// Aguardar a biblioteca carregar
document.addEventListener("DOMContentLoaded", () => {
  // Conectar ao servidor Socket.IO
  if (typeof io !== "undefined") {
    window.socket = io("http://localhost:3000");

    // Eventos de conexão
    socket.on("connect", () => {
      console.log("✅ Conectado ao servidor");
    });

    socket.on("disconnect", () => {
      console.log("❌ Desconectado do servidor");
    });

    // Eventos de pedido
    socket.on("pedido-para-cozinha", (pedido) => {
      console.log("📦 Novo pedido para cozinha:", pedido);
      document.dispatchEvent(
        new CustomEvent("novoPedidoCozinha", { detail: pedido }),
      );
    });

    socket.on("pedido-confirmado", (data) => {
      console.log("✅ Pedido confirmado:", data);
    });

    socket.on("pedido-em-preparo", (pedidoId) => {
      console.log("🔨 Pedido em preparo:", pedidoId);
      document.dispatchEvent(
        new CustomEvent("pedidoEmPreparo", { detail: pedidoId }),
      );
    });

    socket.on("pedido-para-entrega", (pedido) => {
      console.log("🍽️ Pedido pronto para entrega:", pedido);
      document.dispatchEvent(
        new CustomEvent("pedidoPronto", { detail: pedido }),
      );
    });

    socket.on("pedido-finalizado", (pedidoId) => {
      console.log("✅ Pedido finalizado:", pedidoId);
      document.dispatchEvent(
        new CustomEvent("pedidoFinalizado", { detail: pedidoId }),
      );
    });

    // Evento para carregar pedidos existentes
    socket.on("carregar-pedidos", (dados) => {
      console.log("📋 Carregando pedidos existentes:", dados);
      document.dispatchEvent(
        new CustomEvent("carregarPedidos", { detail: dados }),
      );
    });
  } else {
    console.error("❌ Biblioteca Socket.IO não carregada!");
  }
});
