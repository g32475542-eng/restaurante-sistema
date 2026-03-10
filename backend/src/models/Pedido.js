// Simulação de banco de dados (depois substituiremos por SQLite)
let pedidos = [];

class Pedido {
  constructor(mesa, itens, observacao = "") {
    this.id = Date.now().toString();
    this.mesa = mesa;
    this.itens = itens;
    this.observacao = observacao;
    this.status = "pendente"; // pendente, preparando, pronto, entregue
    this.horaPedido = new Date();
    this.horaInicioPreparo = null;
    this.horaPronto = null;
    this.horaEntrega = null;
  }

  static criar(pedidoData) {
    const pedido = new Pedido(
      pedidoData.mesa,
      pedidoData.itens,
      pedidoData.observacao,
    );
    pedidos.push(pedido);
    return pedido;
  }

  static listarPorStatus(status) {
    if (status) {
      return pedidos.filter((p) => p.status === status);
    }
    return pedidos;
  }

  static atualizarStatus(id, novoStatus) {
    const pedido = pedidos.find((p) => p.id === id);
    if (pedido) {
      pedido.status = novoStatus;

      // Registrar horários
      if (novoStatus === "preparando") {
        pedido.horaInicioPreparo = new Date();
      } else if (novoStatus === "pronto") {
        pedido.horaPronto = new Date();
      } else if (novoStatus === "entregue") {
        pedido.horaEntrega = new Date();
      }

      return pedido;
    }
    return null;
  }
}

module.exports = Pedido;
