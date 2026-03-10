// Gerenciador de conexões em tempo real
module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("🔌 Novo cliente conectado:", socket.id);

    // Garçom enviou um novo pedido
    socket.on("novo-pedido", (pedido) => {
      console.log("📝 Novo pedido recebido:", pedido);

      // Adicionar timestamp e status inicial
      pedido.status = "pendente";
      pedido.timestamp = new Date();

      // Enviar para a cozinha
      io.emit("pedido-para-cozinha", pedido);

      // Enviar confirmação para o garçom
      socket.emit("pedido-confirmado", {
        mesa: pedido.mesa,
        mensagem: "Pedido enviado para cozinha!",
      });
    });

    // Cozinha começou a preparar o pedido
    socket.on("iniciar-preparo", (pedidoId) => {
      io.emit("pedido-em-preparo", pedidoId);
    });

    // Cozinha finalizou o pedido
    socket.on("pedido-pronto", (pedido) => {
      io.emit("pedido-para-entrega", pedido);
    });

    // Garçom entregou o pedido
    socket.on("pedido-entregue", (pedidoId) => {
      io.emit("pedido-finalizado", pedidoId);
    });

    socket.on("disconnect", () => {
      console.log("❌ Cliente desconectado:", socket.id);
    });
  });
};
