// Estado da aplicação
let pedidos = {
  pendentes: [],
  preparando: [],
  prontos: [],
};

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 Inicializando cozinha...");

  atualizarRelogio();
  setInterval(atualizarRelogio, 1000);

  // Aguardar socket estar pronto
  setTimeout(() => {
    configurarEventosSocket();
    solicitarPedidosExistentes();
  }, 1000);

  adicionarEstilosGlobais();
});

function adicionarEstilosGlobais() {
  const style = document.createElement("style");
  style.textContent = `
        .notificacao {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: #FF9800;
            color: white;
            border-radius: 5px;
            box-shadow: 0 3px 10px rgba(0,0,0,0.3);
            z-index: 10000;
            font-weight: bold;
            animation: slideIn 0.3s ease;
        }
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        .pedido-card {
            transition: all 0.3s ease;
        }
        .pedido-card.novo {
            animation: pulse 0.5s ease;
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.02); background: #666; }
            100% { transform: scale(1); }
        }
    `;
  document.head.appendChild(style);
}

function atualizarRelogio() {
  const agora = new Date();
  const hora = agora.toLocaleTimeString("pt-BR");
  const relogio = document.getElementById("hora-atual");
  if (relogio) {
    relogio.textContent = `🕐 ${hora}`;
  }
}

function solicitarPedidosExistentes() {
  console.log("📋 Solicitando pedidos existentes ao servidor...");

  if (typeof socket !== "undefined" && socket.connected) {
    socket.emit("solicitar-pedidos");
  } else {
    console.log("⏳ Aguardando conexão do socket...");
    setTimeout(solicitarPedidosExistentes, 1000);
  }
}

function configurarEventosSocket() {
  console.log("🔧 Configurando eventos do socket...");

  if (typeof socket === "undefined") {
    console.error("❌ Socket não disponível");
    return;
  }

  // Receber todos os pedidos de uma vez (quando a cozinha entra)
  socket.on("carregar-pedidos", (dados) => {
    console.log("📦 Carregando pedidos existentes:", dados);

    pedidos.pendentes = dados.pendentes || [];
    pedidos.preparando = dados.preparando || [];
    pedidos.prontos = dados.prontos || [];

    atualizarTodasColunas();
    mostrarNotificacao(
      `📦 ${pedidos.pendentes.length} pedidos pendentes`,
      "info",
    );
  });

  // Novo pedido
  socket.on("pedido-para-cozinha", (pedido) => {
    console.log("📦 Novo pedido recebido:", pedido);

    // Verificar se já não existe
    const existe = pedidos.pendentes.some((p) => p.id === pedido.id);
    if (!existe) {
      pedidos.pendentes.push(pedido);
      atualizarColunaPendentes();
      atualizarContadores();

      // Notificação
      mostrarNotificacao(`🔔 Novo pedido - Mesa ${pedido.mesa}!`, "info");

      // Piscar a tela
      document.body.style.backgroundColor = "#444";
      setTimeout(() => {
        document.body.style.backgroundColor = "#333";
      }, 200);

      // Destaque no card
      destacarNovoPedido(pedido.id);
    }
  });

  // Pedido em preparo
  socket.on("pedido-em-preparo", (pedidoId) => {
    console.log("🔨 Pedido em preparo:", pedidoId);

    // Mover de pendentes para preparando
    const index = pedidos.pendentes.findIndex((p) => p.id === pedidoId);
    if (index !== -1) {
      const pedido = pedidos.pendentes[index];
      pedido.status = "preparando";
      pedidos.pendentes.splice(index, 1);
      pedidos.preparando.push(pedido);
      atualizarTodasColunas();
      mostrarNotificacao(`🔨 Pedido Mesa ${pedido.mesa} em preparo`, "info");
    }
  });

  // Pedido pronto
  socket.on("pedido-para-entrega", (pedido) => {
    console.log("✅ Pedido pronto:", pedido);

    // Se veio o ID
    if (typeof pedido === "string") {
      const index = pedidos.preparando.findIndex((p) => p.id === pedido);
      if (index !== -1) {
        const p = pedidos.preparando[index];
        p.status = "pronto";
        pedidos.preparando.splice(index, 1);
        pedidos.prontos.push(p);
        mostrarNotificacao(`✅ Pedido Mesa ${p.mesa} pronto!`, "sucesso");
      }
    } else {
      // Se veio o objeto completo
      const indexPrep = pedidos.preparando.findIndex((p) => p.id === pedido.id);
      if (indexPrep !== -1) {
        pedidos.preparando.splice(indexPrep, 1);
      }

      const existePronto = pedidos.prontos.some((p) => p.id === pedido.id);
      if (!existePronto) {
        pedido.status = "pronto";
        pedidos.prontos.push(pedido);
        mostrarNotificacao(`✅ Pedido Mesa ${pedido.mesa} pronto!`, "sucesso");
      }
    }

    atualizarTodasColunas();
  });

  // Pedido finalizado (entregue)
  socket.on("pedido-finalizado", (pedidoId) => {
    console.log("✅ Pedido finalizado:", pedidoId);

    const index = pedidos.prontos.findIndex((p) => p.id === pedidoId);
    if (index !== -1) {
      const pedido = pedidos.prontos[index];
      pedidos.prontos.splice(index, 1);
      atualizarColunaProntos();
      atualizarContadores();
      mostrarNotificacao(`🍽️ Pedido Mesa ${pedido.mesa} entregue`, "sucesso");
    }
  });

  console.log("✅ Eventos configurados");
}

function destacarNovoPedido(pedidoId) {
  setTimeout(() => {
    const cards = document.querySelectorAll(".pedido-card");
    cards.forEach((card) => {
      if (card.dataset.id === pedidoId) {
        card.classList.add("novo");
        setTimeout(() => card.classList.remove("novo"), 500);
      }
    });
  }, 100);
}

function atualizarTodasColunas() {
  atualizarColunaPendentes();
  atualizarColunaPreparando();
  atualizarColunaProntos();
  atualizarContadores();
}

function atualizarColunaPendentes() {
  const coluna = document.getElementById("pendentes-lista");
  if (!coluna) return;

  coluna.innerHTML = "";

  if (pedidos.pendentes.length === 0) {
    coluna.innerHTML =
      '<p style="text-align: center; color: #999; padding: 20px;">📭 Nenhum pedido pendente</p>';
    return;
  }

  // Ordenar por hora (mais recentes primeiro)
  const ordenados = [...pedidos.pendentes].sort(
    (a, b) => new Date(b.horaPedido) - new Date(a.horaPedido),
  );

  ordenados.forEach((pedido) => {
    coluna.appendChild(criarCardPedido(pedido, "pendente"));
  });
}

function atualizarColunaPreparando() {
  const coluna = document.getElementById("preparando-lista");
  if (!coluna) return;

  coluna.innerHTML = "";

  if (pedidos.preparando.length === 0) {
    coluna.innerHTML =
      '<p style="text-align: center; color: #999; padding: 20px;">🔨 Nenhum pedido em preparo</p>';
    return;
  }

  pedidos.preparando.forEach((pedido) => {
    coluna.appendChild(criarCardPedido(pedido, "preparando"));
  });
}

function atualizarColunaProntos() {
  const coluna = document.getElementById("prontos-lista");
  if (!coluna) return;

  coluna.innerHTML = "";

  if (pedidos.prontos.length === 0) {
    coluna.innerHTML =
      '<p style="text-align: center; color: #999; padding: 20px;">✅ Nenhum pedido pronto</p>';
    return;
  }

  pedidos.prontos.forEach((pedido) => {
    coluna.appendChild(criarCardPedido(pedido, "pronto"));
  });
}

function atualizarContadores() {
  const pendentesEl = document.getElementById("pedidos-pendentes");
  const preparandoEl = document.getElementById("pedidos-preparando");
  const prontosEl = document.getElementById("pedidos-prontos");

  if (pendentesEl)
    pendentesEl.textContent = `Pendentes: ${pedidos.pendentes.length}`;
  if (preparandoEl)
    preparandoEl.textContent = `Preparando: ${pedidos.preparando.length}`;
  if (prontosEl) prontosEl.textContent = `Prontos: ${pedidos.prontos.length}`;
}

function calcularTempoPedido(horaPedido) {
  if (!horaPedido) return "0 min";

  const agora = new Date();
  const pedidoTime = new Date(horaPedido);
  const diffMs = agora - pedidoTime;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Agora";
  if (diffMin === 1) return "1 min";
  if (diffMin > 30) return `${diffMin} min ⚠️`;
  return `${diffMin} min`;
}

function criarCardPedido(pedido, status) {
  const card = document.createElement("div");
  card.className = `pedido-card ${status}`;
  card.dataset.id = pedido.id;

  const tempo = calcularTempoPedido(pedido.horaPedido);
  const tempoClass = tempo.includes("⚠️")
    ? "tempo-pedido atrasado"
    : "tempo-pedido";

  let itensHtml = "";
  if (pedido.itens && pedido.itens.length > 0) {
    pedido.itens.forEach((item) => {
      const qtd = item.quantidade || 1;
      itensHtml += `
                <div class="item">
                    <span>${qtd}x ${item.nome}</span>
                    <span>R$ ${(item.preco * qtd).toFixed(2)}</span>
                </div>
            `;
    });
  }

  let observacaoHtml = "";
  if (pedido.observacao && pedido.observacao.trim() !== "") {
    observacaoHtml = `<div class="observacao">📝 ${pedido.observacao}</div>`;
  }

  let botoesHtml = "";
  if (status === "pendente") {
    botoesHtml = `
            <div class="acoes-pedido">
                <button class="btn-acao btn-iniciar" onclick="iniciarPreparo('${pedido.id}')">▶️ Iniciar Preparo</button>
            </div>
        `;
  } else if (status === "preparando") {
    botoesHtml = `
            <div class="acoes-pedido">
                <button class="btn-acao btn-pronto" onclick="finalizarPreparo('${pedido.id}')">✅ Pronto!</button>
            </div>
        `;
  } else if (status === "pronto") {
    botoesHtml = `
            <div class="acoes-pedido">
                <span style="color: #4CAF50; font-weight: bold; text-align: center; width: 100%;">
                    ⏰ Aguardando garçom
                </span>
            </div>
        `;
  }

  card.innerHTML = `
        <div class="pedido-header">
            <span class="mesa-numero">Mesa ${pedido.mesa}</span>
            <span class="${tempoClass}">⏱️ ${tempo}</span>
        </div>
        <div class="itens-pedido">
            ${itensHtml}
        </div>
        ${observacaoHtml}
        ${botoesHtml}
    `;

  return card;
}

function mostrarNotificacao(mensagem, tipo = "info") {
  // Remover notificações anteriores
  const notificacoesAntigas = document.querySelectorAll(".notificacao");
  notificacoesAntigas.forEach((n) => n.remove());

  const notificacao = document.createElement("div");
  notificacao.className = "notificacao";

  const cores = {
    sucesso: "#4CAF50",
    erro: "#f44336",
    info: "#FF9800",
  };

  notificacao.style.background = cores[tipo] || cores.info;
  notificacao.textContent = mensagem;

  document.body.appendChild(notificacao);

  setTimeout(() => {
    notificacao.style.animation = "slideOut 0.3s ease";
    setTimeout(() => notificacao.remove(), 300);
  }, 3000);
}

// Funções globais para os botões
window.iniciarPreparo = (pedidoId) => {
  console.log("▶️ Iniciar preparo:", pedidoId);
  if (typeof socket !== "undefined") {
    socket.emit("iniciar-preparo", pedidoId);
    mostrarNotificacao("Preparo iniciado", "info");
  } else {
    console.error("❌ Socket não disponível");
    mostrarNotificacao("Erro ao iniciar preparo", "erro");
  }
};

window.finalizarPreparo = (pedidoId) => {
  console.log("✅ Finalizar preparo:", pedidoId);
  if (typeof socket !== "undefined") {
    socket.emit("pedido-pronto", pedidoId);
    mostrarNotificacao("Pedido marcado como pronto!", "sucesso");
  } else {
    console.error("❌ Socket não disponível");
    mostrarNotificacao("Erro ao finalizar preparo", "erro");
  }
};

// Função para debug
window.verificarPedidos = () => {
  console.log("📊 Estado atual:", pedidos);
  return pedidos;
};
