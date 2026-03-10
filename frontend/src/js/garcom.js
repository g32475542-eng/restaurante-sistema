// Estado da aplicação
let mesaSelecionada = null;
let carrinho = [];
let cardapio = [];

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
  carregarCardapio();
  carregarMesas();
  configurarEventos();

  // Verificar conexão com socket
  if (typeof socket !== "undefined") {
    console.log("✅ Socket conectado:", socket.id);
  } else {
    console.error("❌ Socket não encontrado!");
  }
});

function carregarCardapio() {
  // Carregar cardápio do localStorage (salvo pelo admin)
  const cardapioSalvo = localStorage.getItem("cardapio");

  if (cardapioSalvo) {
    cardapio = JSON.parse(cardapioSalvo);
    console.log("📋 Cardápio carregado do admin:", cardapio);
  } else {
    // Cardápio padrão caso não tenha nada salvo
    cardapio = [
      {
        id: 1,
        nome: "Filé à Parmegiana",
        preco: 45.9,
        categoria: "pratos",
        descricao: "Filé mignon empanado com molho parmegiana e queijo",
      },
      {
        id: 2,
        nome: "Frango Grelhado",
        preco: 32.9,
        categoria: "pratos",
        descricao: "Peito de frango grelhado com legumes",
      },
      {
        id: 3,
        nome: "Coca Cola 2L",
        preco: 12.9,
        categoria: "bebidas",
        descricao: "Refrigerante Coca Cola 2 litros",
      },
      {
        id: 4,
        nome: "Suco de Laranja",
        preco: 8.9,
        categoria: "bebidas",
        descricao: "Suco natural de laranja 500ml",
      },
      {
        id: 5,
        nome: "Pudim",
        preco: 15.9,
        categoria: "sobremesas",
        descricao: "Pudim de leite condensado com calda de caramelo",
      },
      {
        id: 6,
        nome: "Brownie",
        preco: 18.9,
        categoria: "sobremesas",
        descricao: "Brownie de chocolate com sorvete",
      },
      {
        id: 7,
        nome: "Batata Frita",
        preco: 22.9,
        categoria: "entradas",
        descricao: "Porção de batata frita crocante",
      },
      {
        id: 8,
        nome: "Caldo de Mandioca",
        preco: 16.9,
        categoria: "entradas",
        descricao: "Caldo de mandioca com carne seca",
      },
    ];
    // Salvar cardápio padrão no localStorage
    localStorage.setItem("cardapio", JSON.stringify(cardapio));
  }

  // Carregar itens na tela
  carregarItensCardapio("todos");
}

function carregarMesas() {
  const listaMesas = document.getElementById("lista-mesas");
  if (!listaMesas) return;

  listaMesas.innerHTML = "";

  // Criar 12 mesas
  for (let i = 1; i <= 12; i++) {
    const mesaDiv = document.createElement("div");
    mesaDiv.className = "mesa-item";
    mesaDiv.textContent = `Mesa ${i}`;
    mesaDiv.dataset.mesa = i;

    // Verificar se mesa tem pedidos ativos (simulado)
    const pedidosAtivos = JSON.parse(
      sessionStorage.getItem(`mesa_${i}_pedidos`) || "[]",
    );
    if (pedidosAtivos.length > 0) {
      mesaDiv.classList.add("ocupada");
    }

    mesaDiv.addEventListener("click", () => selecionarMesa(i));

    listaMesas.appendChild(mesaDiv);
  }
}

function carregarItensCardapio(categoria = "todos") {
  const container = document.getElementById("itens-cardapio");
  if (!container) return;

  container.innerHTML = "";

  const itensFiltrados =
    categoria === "todos"
      ? cardapio
      : cardapio.filter((item) => item.categoria === categoria);

  if (itensFiltrados.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; color: #999; grid-column: 1/-1;">Nenhum item nesta categoria</p>';
    return;
  }

  itensFiltrados.forEach((item) => {
    const itemDiv = document.createElement("div");
    itemDiv.className = "item-cardapio";
    itemDiv.innerHTML = `
            <div class="item-nome">${item.nome}</div>
            <div class="item-preco">R$ ${item.preco.toFixed(2)}</div>
            ${item.descricao ? `<small style="color: #666;">${item.descricao.substring(0, 30)}...</small>` : ""}
        `;

    itemDiv.addEventListener("click", () => adicionarAoCarrinho(item));

    container.appendChild(itemDiv);
  });
}

function configurarEventos() {
  // Eventos das categorias
  document.querySelectorAll(".categoria-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".categoria-btn")
        .forEach((b) => b.classList.remove("ativo"));
      e.target.classList.add("ativo");
      carregarItensCardapio(e.target.dataset.categoria);
    });
  });

  // Botão enviar pedido
  const btnEnviar = document.getElementById("btn-enviar");
  if (btnEnviar) {
    btnEnviar.addEventListener("click", enviarPedido);
  }

  // Observação com Enter (não enviar formulário)
  const observacao = document.getElementById("observacao");
  if (observacao) {
    observacao.addEventListener("keypress", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (carrinho.length > 0 && mesaSelecionada) {
          enviarPedido();
        }
      }
    });
  }

  // Eventos do socket
  if (typeof socket !== "undefined") {
    socket.on("pedido-confirmado", (data) => {
      mostrarNotificacao(
        `✅ Pedido da mesa ${data.mesa} enviado com sucesso!`,
        "sucesso",
      );
    });

    socket.on("pedido-em-preparo", (pedidoId) => {
      console.log("🔨 Pedido em preparo:", pedidoId);
    });

    socket.on("pedido-para-entrega", (pedido) => {
      if (pedido.mesa === mesaSelecionada) {
        mostrarNotificacao(
          `🍽️ Pedido da mesa ${pedido.mesa} está pronto para entrega!`,
          "info",
        );
      }
    });
  }
}

function selecionarMesa(numero) {
  mesaSelecionada = numero;

  const mesaTitulo = document.getElementById("mesa-titulo");
  const mesaNumero = document.getElementById("mesa-numero");

  if (mesaTitulo) mesaTitulo.textContent = `Mesa ${numero}`;
  if (mesaNumero) mesaNumero.textContent = numero;

  // Destacar mesa selecionada
  document.querySelectorAll(".mesa-item").forEach((mesa) => {
    mesa.style.background = "#e0e0e0";
    mesa.style.color = "#333";
  });

  const mesaSelecionadaEl = document.querySelector(`[data-mesa="${numero}"]`);
  if (mesaSelecionadaEl) {
    mesaSelecionadaEl.style.background = "#4CAF50";
    mesaSelecionadaEl.style.color = "white";
  }

  // Carregar pedidos anteriores da mesa (se houver)
  carregarPedidosMesa(numero);

  mostrarNotificacao(`Mesa ${numero} selecionada`, "info");
}

function carregarPedidosMesa(mesaNumero) {
  // Verificar se há pedidos anteriores para esta mesa
  const pedidosAnteriores = JSON.parse(
    sessionStorage.getItem(`mesa_${mesaNumero}_pedidos`) || "[]",
  );

  if (pedidosAnteriores.length > 0) {
    const ultimoPedido = pedidosAnteriores[pedidosAnteriores.length - 1];
    if (ultimoPedido.itens && ultimoPedido.itens.length > 0) {
      if (
        confirm(
          `Mesa ${mesaNumero} tem pedidos anteriores. Deseja carregar o último pedido?`,
        )
      ) {
        carrinho = [...ultimoPedido.itens];
        atualizarCarrinho();
      }
    }
  }
}

function adicionarAoCarrinho(item) {
  if (!mesaSelecionada) {
    mostrarNotificacao("Selecione uma mesa primeiro!", "erro");
    return;
  }

  // Verificar se item já está no carrinho
  const itemExistente = carrinho.find((i) => i.id === item.id);

  if (itemExistente) {
    itemExistente.quantidade = (itemExistente.quantidade || 1) + 1;
  } else {
    carrinho.push({
      ...item,
      quantidade: 1,
    });
  }

  atualizarCarrinho();
  mostrarNotificacao(`${item.nome} adicionado ao carrinho`, "sucesso");
}

function removerDoCarrinho(index) {
  const itemRemovido = carrinho[index];
  carrinho.splice(index, 1);
  atualizarCarrinho();
  mostrarNotificacao(`${itemRemovido.nome} removido do carrinho`, "info");
}

function aumentarQuantidade(index) {
  if (carrinho[index]) {
    carrinho[index].quantidade = (carrinho[index].quantidade || 1) + 1;
    atualizarCarrinho();
  }
}

function diminuirQuantidade(index) {
  if (carrinho[index] && carrinho[index].quantidade > 1) {
    carrinho[index].quantidade -= 1;
    atualizarCarrinho();
  } else {
    removerDoCarrinho(index);
  }
}

function atualizarCarrinho() {
  const container = document.getElementById("carrinho-itens");
  const btnEnviar = document.getElementById("btn-enviar");
  const totalItens = document.getElementById("total-itens");
  const totalPreco = document.getElementById("total-preco");

  if (!container) return;

  container.innerHTML = "";

  if (carrinho.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; color: #999; padding: 20px;">🛒 Carrinho vazio</p>';
    if (btnEnviar) btnEnviar.disabled = true;

    // Atualizar totais
    if (totalItens) totalItens.textContent = "0";
    if (totalPreco) totalPreco.textContent = "R$ 0,00";
    return;
  }

  let total = 0;
  let quantidadeTotal = 0;

  carrinho.forEach((item, index) => {
    const subtotal = item.preco * (item.quantidade || 1);
    total += subtotal;
    quantidadeTotal += item.quantidade || 1;

    const itemDiv = document.createElement("div");
    itemDiv.className = "carrinho-item";
    itemDiv.innerHTML = `
            <div style="flex: 2;">
                <strong>${item.nome}</strong>
            </div>
            <div style="flex: 1; text-align: center;">
                <button class="btn-qtd" onclick="diminuirQuantidade(${index})">-</button>
                <span style="margin: 0 10px;">${item.quantidade || 1}</span>
                <button class="btn-qtd" onclick="aumentarQuantidade(${index})">+</button>
            </div>
            <div style="flex: 1; text-align: right;">
                R$ ${subtotal.toFixed(2)}
                <span class="remover" onclick="removerDoCarrinho(${index})" style="margin-left: 10px;">❌</span>
            </div>
        `;

    container.appendChild(itemDiv);
  });

  // Adicionar estilo para botões de quantidade
  const style = document.createElement("style");
  style.textContent = `
        .btn-qtd {
            background: #4CAF50;
            color: white;
            border: none;
            width: 25px;
            height: 25px;
            border-radius: 50%;
            cursor: pointer;
            font-weight: bold;
        }
        .btn-qtd:hover {
            background: #45a049;
        }
    `;
  document.head.appendChild(style);

  // Atualizar totais
  if (totalItens) totalItens.textContent = quantidadeTotal;
  if (totalPreco) totalPreco.textContent = `R$ ${total.toFixed(2)}`;

  if (btnEnviar) btnEnviar.disabled = false;
}

function enviarPedido() {
  if (!mesaSelecionada) {
    mostrarNotificacao("Selecione uma mesa!", "erro");
    return;
  }

  if (carrinho.length === 0) {
    mostrarNotificacao("Adicione itens ao carrinho!", "erro");
    return;
  }

  const observacao = document.getElementById("observacao")?.value || "";

  // Calcular total
  const total = carrinho.reduce(
    (acc, item) => acc + item.preco * (item.quantidade || 1),
    0,
  );

  const pedido = {
    id: Date.now().toString(),
    mesa: mesaSelecionada,
    itens: carrinho.map((item) => ({
      ...item,
      subtotal: item.preco * (item.quantidade || 1),
    })),
    observacao: observacao,
    total: total,
    horaPedido: new Date().toISOString(),
    horaPedidoFormatada: new Date().toLocaleTimeString(),
    status: "pendente",
  };

  // Salvar pedido no histórico da mesa
  const pedidosMesa = JSON.parse(
    sessionStorage.getItem(`mesa_${mesaSelecionada}_pedidos`) || "[]",
  );
  pedidosMesa.push(pedido);
  sessionStorage.setItem(
    `mesa_${mesaSelecionada}_pedidos`,
    JSON.stringify(pedidosMesa),
  );

  // Enviar via socket
  if (typeof socket !== "undefined") {
    socket.emit("novo-pedido", pedido);
    console.log("📤 Pedido enviado:", pedido);
  } else {
    console.error("❌ Socket não disponível");
    mostrarNotificacao("Erro ao enviar pedido!", "erro");
    return;
  }

  // Marcar mesa como ocupada
  const mesaElement = document.querySelector(
    `[data-mesa="${mesaSelecionada}"]`,
  );
  if (mesaElement) {
    mesaElement.classList.add("ocupada");
  }

  // Limpar carrinho
  carrinho = [];
  atualizarCarrinho();

  const observacaoInput = document.getElementById("observacao");
  if (observacaoInput) observacaoInput.value = "";

  // Mostrar resumo do pedido
  mostrarResumoPedido(pedido);
}

function mostrarResumoPedido(pedido) {
  const resumoDiv = document.createElement("div");
  resumoDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 30px;
        border-radius: 10px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        z-index: 10000;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
    `;

  let itensHtml = "";
  pedido.itens.forEach((item) => {
    itensHtml += `
            <tr>
                <td>${item.nome}</td>
                <td>${item.quantidade}x</td>
                <td>R$ ${item.preco.toFixed(2)}</td>
                <td>R$ ${(item.preco * item.quantidade).toFixed(2)}</td>
            </tr>
        `;
  });

  resumoDiv.innerHTML = `
        <h2 style="color: #4CAF50; margin-bottom: 20px;">✅ Pedido Enviado!</h2>
        <p><strong>Mesa:</strong> ${pedido.mesa}</p>
        <p><strong>Hora:</strong> ${pedido.horaPedidoFormatada}</p>
        <p><strong>Observação:</strong> ${pedido.observacao || "Sem observações"}</p>
        
        <table style="width: 100%; margin-top: 20px; border-collapse: collapse;">
            <thead>
                <tr style="background: #f5f5f5;">
                    <th style="padding: 10px; text-align: left;">Item</th>
                    <th style="padding: 10px;">Qtd</th>
                    <th style="padding: 10px;">Preço</th>
                    <th style="padding: 10px;">Subtotal</th>
                </tr>
            </thead>
            <tbody>
                ${itensHtml}
            </tbody>
            <tfoot>
                <tr style="background: #f0f0f0; font-weight: bold;">
                    <td colspan="3" style="padding: 10px; text-align: right;">Total:</td>
                    <td style="padding: 10px;">R$ ${pedido.total.toFixed(2)}</td>
                </tr>
            </tfoot>
        </table>
        
        <button onclick="this.parentElement.remove()" style="
            width: 100%;
            padding: 15px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            margin-top: 20px;
            cursor: pointer;
            font-weight: bold;
        ">Fechar</button>
    `;

  // Adicionar overlay
  const overlay = document.createElement("div");
  overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 9999;
    `;
  overlay.onclick = () => {
    overlay.remove();
    resumoDiv.remove();
  };

  document.body.appendChild(overlay);
  document.body.appendChild(resumoDiv);
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
    info: "#2196F3",
  };

  notificacao.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${cores[tipo] || cores.info};
        color: white;
        border-radius: 5px;
        box-shadow: 0 3px 10px rgba(0,0,0,0.2);
        z-index: 10001;
        font-weight: bold;
        animation: slideIn 0.3s ease;
    `;

  notificacao.textContent = mensagem;

  document.body.appendChild(notificacao);

  setTimeout(() => {
    notificacao.style.animation = "slideOut 0.3s ease";
    setTimeout(() => notificacao.remove(), 300);
  }, 3000);
}

// Adicionar animações
const style = document.createElement("style");
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Tornar funções globais para os botões
window.removerDoCarrinho = removerDoCarrinho;
window.aumentarQuantidade = aumentarQuantidade;
window.diminuirQuantidade = diminuirQuantidade;
