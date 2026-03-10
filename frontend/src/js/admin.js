// Estado da aplicação
let usuarios = [
  {
    id: 1,
    nome: "Administrador",
    usuario: "admin",
    senha: "123456",
    tipo: "admin",
  },
  {
    id: 2,
    nome: "João Garçom",
    usuario: "joao",
    senha: "123456",
    tipo: "garcom",
  },
  {
    id: 3,
    nome: "Maria Cozinha",
    usuario: "maria",
    senha: "123456",
    tipo: "cozinha",
  },
];

let cardapio = [
  {
    id: 1,
    nome: "Filé à Parmegiana",
    preco: 45.9,
    categoria: "pratos",
    descricao: "Filé mignon à parmegiana",
  },
  {
    id: 2,
    nome: "Frango Grelhado",
    preco: 32.9,
    categoria: "pratos",
    descricao: "Frango grelhado com legumes",
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
    descricao: "Suco natural de laranja",
  },
  {
    id: 5,
    nome: "Pudim",
    preco: 15.9,
    categoria: "sobremesas",
    descricao: "Pudim de leite condensado",
  },
  {
    id: 6,
    nome: "Brownie",
    preco: 18.9,
    categoria: "sobremesas",
    descricao: "Brownie de chocolate com sorvete",
  },
];

let usuarioLogado = null;

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
  configurarEventos();
});

function configurarEventos() {
  // Login
  const btnLogin = document.getElementById("btn-login");
  if (btnLogin) {
    btnLogin.addEventListener("click", fazerLogin);
  }

  // Logout
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", fazerLogout);
  }

  // Tabs
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const tab = e.target.dataset.tab;
      abrirTab(tab);
    });
  });

  // Formulário de item
  const formItem = document.getElementById("form-item");
  if (formItem) {
    formItem.addEventListener("submit", (e) => {
      e.preventDefault();
      salvarItem();
    });
  }

  // Botão cancelar
  const btnCancelar = document.getElementById("btn-cancelar");
  if (btnCancelar) {
    btnCancelar.addEventListener("click", limparFormItem);
  }

  // Formulário de usuário
  const formUsuario = document.getElementById("form-usuario");
  if (formUsuario) {
    formUsuario.addEventListener("submit", (e) => {
      e.preventDefault();
      salvarUsuario();
    });
  }

  // Botão gerar relatório
  const btnRelatorio = document.getElementById("btn-gerar-relatorio");
  if (btnRelatorio) {
    btnRelatorio.addEventListener("click", gerarRelatorio);
  }

  // Botão salvar configurações
  const btnConfig = document.getElementById("btn-salvar-config");
  if (btnConfig) {
    btnConfig.addEventListener("click", salvarConfiguracoes);
  }

  // Enter no campo senha
  const inputSenha = document.getElementById("senha");
  if (inputSenha) {
    inputSenha.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        fazerLogin();
      }
    });
  }
}

function fazerLogin() {
  const usuario = document.getElementById("usuario").value;
  const senha = document.getElementById("senha").value;

  const user = usuarios.find((u) => u.usuario === usuario && u.senha === senha);

  if (user) {
    usuarioLogado = user;
    document.getElementById("login-section").style.display = "none";
    document.getElementById("admin-section").style.display = "block";
    document.getElementById("erro-login").style.display = "none";

    // Carregar dados
    carregarCardapio();
    carregarUsuarios();

    console.log("Login realizado com sucesso!");
  } else {
    document.getElementById("erro-login").style.display = "block";
  }
}

function fazerLogout() {
  usuarioLogado = null;
  document.getElementById("login-section").style.display = "block";
  document.getElementById("admin-section").style.display = "none";
  document.getElementById("usuario").value = "";
  document.getElementById("senha").value = "";
}

function abrirTab(tabName) {
  // Atualizar botões
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("ativo");
    if (btn.dataset.tab === tabName) {
      btn.classList.add("ativo");
    }
  });

  // Atualizar conteúdo
  document.querySelectorAll(".tab-pane").forEach((pane) => {
    pane.classList.remove("ativo");
  });
  document.getElementById(`tab-${tabName}`).classList.add("ativo");

  // Carregar dados da tab
  if (tabName === "cardapio") {
    carregarCardapio();
  } else if (tabName === "usuarios") {
    carregarUsuarios();
  }
}

// Funções do Cardápio
function carregarCardapio() {
  const tbody = document.getElementById("tabela-cardapio-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  cardapio.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
            <td>${item.id}</td>
            <td>${item.nome}</td>
            <td>R$ ${item.preco.toFixed(2)}</td>
            <td>${item.categoria}</td>
            <td>
                <button class="btn-editar" onclick="editarItem(${item.id})">✏️ Editar</button>
                <button class="btn-excluir" onclick="excluirItem(${item.id})">🗑️ Excluir</button>
            </td>
        `;
    tbody.appendChild(tr);
  });

  // Atualizar cardápio no localStorage para o garçom
  localStorage.setItem("cardapio", JSON.stringify(cardapio));
}

function salvarItem() {
  const id = document.getElementById("item-id").value;
  const nome = document.getElementById("item-nome").value;
  const preco = parseFloat(document.getElementById("item-preco").value);
  const categoria = document.getElementById("item-categoria").value;
  const descricao = document.getElementById("item-descricao").value;

  if (id) {
    // Editar existente
    const item = cardapio.find((i) => i.id === parseInt(id));
    if (item) {
      item.nome = nome;
      item.preco = preco;
      item.categoria = categoria;
      item.descricao = descricao;
    }
  } else {
    // Novo item
    const novoItem = {
      id: cardapio.length + 1,
      nome,
      preco,
      categoria,
      descricao,
    };
    cardapio.push(novoItem);
  }

  limparFormItem();
  carregarCardapio();
  mostrarMensagem("Item salvo com sucesso!", "sucesso");
}

function editarItem(id) {
  const item = cardapio.find((i) => i.id === id);
  if (item) {
    document.getElementById("item-id").value = item.id;
    document.getElementById("item-nome").value = item.nome;
    document.getElementById("item-preco").value = item.preco;
    document.getElementById("item-categoria").value = item.categoria;
    document.getElementById("item-descricao").value = item.descricao || "";
  }
}

function excluirItem(id) {
  if (confirm("Tem certeza que deseja excluir este item?")) {
    cardapio = cardapio.filter((i) => i.id !== id);
    carregarCardapio();
    mostrarMensagem("Item excluído com sucesso!", "sucesso");
  }
}

function limparFormItem() {
  document.getElementById("item-id").value = "";
  document.getElementById("item-nome").value = "";
  document.getElementById("item-preco").value = "";
  document.getElementById("item-categoria").value = "pratos";
  document.getElementById("item-descricao").value = "";
}

// Funções de Usuários
function carregarUsuarios() {
  const tbody = document.getElementById("tabela-usuarios-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  usuarios.forEach((user) => {
    if (user.id !== 1) {
      // Não mostrar o admin principal
      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td>${user.id}</td>
                <td>${user.nome}</td>
                <td>${user.usuario}</td>
                <td>${user.tipo}</td>
                <td>
                    <button class="btn-editar" onclick="editarUsuario(${user.id})">✏️ Editar</button>
                    <button class="btn-excluir" onclick="excluirUsuario(${user.id})">🗑️ Excluir</button>
                </td>
            `;
      tbody.appendChild(tr);
    }
  });
}

function salvarUsuario() {
  const id = document.getElementById("usuario-id").value;
  const nome = document.getElementById("usuario-nome").value;
  const usuario = document.getElementById("usuario-login").value;
  const senha = document.getElementById("usuario-senha").value;
  const tipo = document.getElementById("usuario-tipo").value;

  if (id) {
    // Editar existente
    const user = usuarios.find((u) => u.id === parseInt(id));
    if (user) {
      user.nome = nome;
      user.usuario = usuario;
      user.tipo = tipo;
      if (senha) {
        user.senha = senha;
      }
    }
  } else {
    // Novo usuário
    const novoUsuario = {
      id: usuarios.length + 1,
      nome,
      usuario,
      senha: senha || "123456",
      tipo,
    };
    usuarios.push(novoUsuario);
  }

  limparFormUsuario();
  carregarUsuarios();
  mostrarMensagem("Usuário salvo com sucesso!", "sucesso");
}

function editarUsuario(id) {
  const user = usuarios.find((u) => u.id === id);
  if (user) {
    document.getElementById("usuario-id").value = user.id;
    document.getElementById("usuario-nome").value = user.nome;
    document.getElementById("usuario-login").value = user.usuario;
    document.getElementById("usuario-senha").value = "";
    document.getElementById("usuario-tipo").value = user.tipo;
  }
}

function excluirUsuario(id) {
  if (id === 1) {
    alert("Não é possível excluir o administrador principal!");
    return;
  }

  if (confirm("Tem certeza que deseja excluir este usuário?")) {
    usuarios = usuarios.filter((u) => u.id !== id);
    carregarUsuarios();
    mostrarMensagem("Usuário excluído com sucesso!", "sucesso");
  }
}

function limparFormUsuario() {
  document.getElementById("usuario-id").value = "";
  document.getElementById("usuario-nome").value = "";
  document.getElementById("usuario-login").value = "";
  document.getElementById("usuario-senha").value = "";
  document.getElementById("usuario-tipo").value = "garcom";
}

// Funções de Relatório
function gerarRelatorio() {
  const data =
    document.getElementById("data-relatorio").value ||
    new Date().toISOString().split("T")[0];

  // Simular relatório
  const relatorioDiv = document.getElementById("relatorio-resultado");
  relatorioDiv.innerHTML = `
        <h3>Relatório do dia ${data}</h3>
        <table class="tabela-cardapio">
            <tr>
                <th>Total de Pedidos</th>
                <td>15</td>
            </tr>
            <tr>
                <th>Faturamento Total</th>
                <td>R$ 1.234,50</td>
            </tr>
            <tr>
                <th>Pedidos por Mesa</th>
                <td>Média: 3.2 pedidos/mesa</td>
            </tr>
            <tr>
                <th>Item mais vendido</th>
                <td>Filé à Parmegiana (8 unidades)</td>
            </tr>
        </table>
    `;
}

// Funções de Configuração
function salvarConfiguracoes() {
  const nome = document.getElementById("config-nome").value;
  const tempo = document.getElementById("config-tempo").value;

  localStorage.setItem("config-nome", nome);
  localStorage.setItem("config-tempo", tempo);

  mostrarMensagem("Configurações salvas com sucesso!", "sucesso");
}

// Função auxiliar para mostrar mensagens
function mostrarMensagem(texto, tipo) {
  // Criar elemento de mensagem
  const msgDiv = document.createElement("div");
  msgDiv.textContent = texto;
  msgDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${tipo === "sucesso" ? "#4CAF50" : "#f44336"};
        color: white;
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        z-index: 9999;
    `;

  document.body.appendChild(msgDiv);

  setTimeout(() => {
    msgDiv.remove();
  }, 3000);
}

// Tornar funções globais
window.editarItem = editarItem;
window.excluirItem = excluirItem;
window.editarUsuario = editarUsuario;
window.excluirUsuario = excluirUsuario;
