// ===== ESTADO DA APLICAÇÃO =====
let state = {
    mesaSelecionada: null,
    carrinho: [],
    cardapio: [],
    categorias: [],
    mesas: [],
    pedidosProntos: [],
    config: {}
};

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Inicializando painel do garçom...');
    
    // Configurar socket
    setupSocket();
    
    // Carregar dados
    await carregarCategorias();
    await carregarCardapio();
    await carregarMesas();
    
    // Configurar eventos
    configurarEventos();
    
    // Iniciar atualização de pedidos prontos
    setInterval(buscarPedidosProntos, 5000);
});

// ===== SOCKET.IO =====
function setupSocket() {
    const serverUrl = window.location.origin;
    window.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10
    });
    
    socket.on('connect', () => {
        console.log('✅ Conectado ao servidor');
        mostrarNotificacao('Conectado ao servidor', 'success');
    });
    
    socket.on('pedido-para-entrega', (pedidoId) => {
        console.log('🍽️ Pedido pronto:', pedidoId);
        buscarPedidosProntos();
        mostrarNotificacao('Novo pedido pronto para entrega!', 'success');
    });
    
    socket.on('pedido-confirmado', (data) => {
        console.log('✅ Pedido confirmado:', data);
    });
}

// ===== CARREGAR DADOS =====
async function carregarCategorias() {
    try {
        const response = await fetch('/api/categorias');
        state.categorias = await response.json();
        
        const container = document.getElementById('categorias');
        container.innerHTML = '<button class="categoria-btn ativo" data-categoria="todos">Todos 📋</button>';
        
        state.categorias.forEach(cat => {
            if (cat.ativo) {
                const btn = document.createElement('button');
                btn.className = 'categoria-btn';
                btn.dataset.categoria = cat.id;
                btn.innerHTML = `${cat.icone} ${cat.nome}`;
                container.appendChild(btn);
            }
        });
        
        console.log('📋 Categorias carregadas:', state.categorias.length);
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
    }
}

async function carregarCardapio(categoriaId = 'todos') {
    try {
        const response = await fetch('/api/cardapio');
        state.cardapio = await response.json();
        
        const container = document.getElementById('cardapio-grid');
        container.innerHTML = '';
        
        let itensFiltrados = state.cardapio;
        if (categoriaId !== 'todos') {
            itensFiltrados = state.cardapio.filter(item => item.categoria_id == categoriaId);
        }
        
        if (itensFiltrados.length === 0) {
            container.innerHTML = '<p class="text-center" style="grid-column: 1/-1; padding: 40px;">📭 Nenhum item disponível</p>';
            return;
        }
        
        itensFiltrados.forEach(item => {
            const card = document.createElement('div');
            card.className = `item-card ${item.disponivel ? '' : 'indisponivel'}`;
            card.innerHTML = `
                <div class="item-nome">${item.nome}</div>
                <div class="item-preco">${formatarPreco(item.preco)}</div>
                ${item.descricao ? `<div class="item-desc">${item.descricao.substring(0, 30)}...</div>` : ''}
                <div style="font-size: 0.75rem; color: #999; margin-top: 5px;">
                    ⏱️ ${item.tempo_preparo}min
                </div>
            `;
            
            if (item.disponivel) {
                card.addEventListener('click', () => adicionarAoCarrinho(item));
            }
            
            container.appendChild(card);
        });
        
        console.log('📋 Cardápio carregado:', itensFiltrados.length, 'itens');
    } catch (error) {
        console.error('Erro ao carregar cardápio:', error);
    }
}

async function carregarMesas() {
    try {
        const response = await fetch('/api/mesas');
        state.mesas = await response.json();
        
        const container = document.getElementById('mesas-grid');
        container.innerHTML = '';
        
        state.mesas.forEach(mesa => {
            const card = document.createElement('div');
            card.className = `mesa-card ${mesa.status}`;
            card.dataset.mesa = mesa.id;
            card.innerHTML = `
                <div class="mesa-numero">${mesa.numero}</div>
                <div class="mesa-status">${mesa.status === 'ocupada' ? '👥 Ocupada' : '✅ Livre'}</div>
            `;
            
            card.addEventListener('click', () => selecionarMesa(mesa));
            container.appendChild(card);
        });
        
        document.getElementById('mesas-count').textContent = state.mesas.length;
        console.log('🪑 Mesas carregadas:', state.mesas.length);
    } catch (error) {
        console.error('Erro ao carregar mesas:', error);
    }
}

async function buscarPedidosProntos() {
    try {
        const response = await fetch('/api/pedidos/prontos');
        const pedidos = await response.json();
        
        const panel = document.getElementById('prontos-panel');
        const lista = document.getElementById('prontos-lista');
        const count = document.getElementById('prontos-count');
        
        if (pedidos.length > 0) {
            panel.style.display = 'block';
            count.textContent = pedidos.length;
            
            lista.innerHTML = '';
            pedidos.forEach(pedido => {
                const card = document.createElement('div');
                card.className = 'pronto-card';
                card.innerHTML = `
                    <div class="mesa">Mesa ${pedido.mesa_numero}</div>
                    <div class="hora">${formatarData(pedido.created_at)}</div>
                    <div style="margin-top: 10px;">
                        <button class="btn btn-sm btn-primary" onclick="entregarPedido('${pedido.id}')">
                            ✅ Entregar
                        </button>
                    </div>
                `;
                lista.appendChild(card);
            });
        } else {
            panel.style.display = 'none';
        }
    } catch (error) {
        console.error('Erro ao buscar pedidos prontos:', error);
    }
}

// ===== FUNÇÕES DO CARRINHO =====
function adicionarAoCarrinho(item) {
    if (!state.mesaSelecionada) {
        mostrarNotificacao('Selecione uma mesa primeiro!', 'error');
        return;
    }
    
    const existente = state.carrinho.find(i => i.id === item.id);
    
    if (existente) {
        existente.quantidade = (existente.quantidade || 1) + 1;
    } else {
        state.carrinho.push({
            ...item,
            quantidade: 1
        });
    }
    
    atualizarCarrinho();
    mostrarNotificacao(`${item.nome} adicionado`, 'success');
}

function removerDoCarrinho(index) {
    const item = state.carrinho[index];
    state.carrinho.splice(index, 1);
    atualizarCarrinho();
    mostrarNotificacao(`${item.nome} removido`, 'info');
}

function aumentarQuantidade(index) {
    if (state.carrinho[index]) {
        state.carrinho[index].quantidade++;
        atualizarCarrinho();
    }
}

function diminuirQuantidade(index) {
    if (state.carrinho[index] && state.carrinho[index].quantidade > 1) {
        state.carrinho[index].quantidade--;
        atualizarCarrinho();
    } else {
        removerDoCarrinho(index);
    }
}

function atualizarCarrinho() {
    const container = document.getElementById('carrinho-itens');
    const btnEnviar = document.getElementById('btn-enviar');
    const countSpan = document.getElementById('carrinho-count');
    const subtotalSpan = document.getElementById('subtotal');
    const totalSpan = document.getElementById('total');
    
    container.innerHTML = '';
    
    if (state.carrinho.length === 0) {
        container.innerHTML = '<p class="text-center" style="padding: 20px;">🛒 Carrinho vazio</p>';
        btnEnviar.disabled = true;
        countSpan.textContent = '0';
        subtotalSpan.textContent = formatarPreco(0);
        totalSpan.textContent = formatarPreco(0);
        return;
    }
    
    let subtotal = 0;
    let totalItens = 0;
    
    state.carrinho.forEach((item, index) => {
        const qtd = item.quantidade || 1;
        const itemTotal = item.preco * qtd;
        subtotal += itemTotal;
        totalItens += qtd;
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'carrinho-item';
        itemDiv.innerHTML = `
            <div class="item-info">
                <strong>${item.nome}</strong>
                <span class="item-subtotal">${formatarPreco(itemTotal)}</span>
            </div>
            <div class="item-acoes">
                <button class="qtd-btn minus" onclick="diminuirQuantidade(${index})">-</button>
                <span class="item-qtd">${qtd}</span>
                <button class="qtd-btn" onclick="aumentarQuantidade(${index})">+</button>
                <button class="qtd-btn minus" onclick="removerDoCarrinho(${index})" style="background: var(--danger);">×</button>
            </div>
        `;
        
        container.appendChild(itemDiv);
    });
    
    btnEnviar.disabled = false;
    countSpan.textContent = totalItens;
    subtotalSpan.textContent = formatarPreco(subtotal);
    totalSpan.textContent = formatarPreco(subtotal);
}

// ===== FUNÇÕES DE MESA =====
function selecionarMesa(mesa) {
    state.mesaSelecionada = mesa;
    
    // Atualizar UI
    document.querySelectorAll('.mesa-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    const cardSelecionado = document.querySelector(`[data-mesa="${mesa.id}"]`);
    if (cardSelecionado) {
        cardSelecionado.classList.add('selected');
    }
    
    document.getElementById('mesa-titulo').innerHTML = `
        Mesa ${mesa.numero} 
        <small style="font-size: 0.9rem; color: var(--gray); margin-left: 10px;">
            ${mesa.status === 'ocupada' ? '👥 Ocupada' : '✅ Livre'}
        </small>
    `;
    
    mostrarNotificacao(`Mesa ${mesa.numero} selecionada`, 'info');
}

// ===== ENVIAR PEDIDO =====
async function enviarPedido() {
    if (!state.mesaSelecionada) {
        mostrarNotificacao('Selecione uma mesa!', 'error');
        return;
    }
    
    if (state.carrinho.length === 0) {
        mostrarNotificacao('Adicione itens ao carrinho!', 'error');
        return;
    }
    
    const observacao = document.getElementById('observacao').value;
    const total = state.carrinho.reduce((acc, item) => 
        acc + (item.preco * (item.quantidade || 1)), 0
    );
    
    const pedido = {
        mesa: state.mesaSelecionada.id,
        itens: state.carrinho.map(item => ({
            id: item.id,
            nome: item.nome,
            preco: item.preco,
            quantidade: item.quantidade || 1
        })),
        observacao,
        total
    };
    
    try {
        const response = await fetch('/api/pedidos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pedido)
        });
        
        if (!response.ok) throw new Error('Erro ao enviar pedido');
        
        const data = await response.json();
        
        // Limpar carrinho
        state.carrinho = [];
        atualizarCarrinho();
        document.getElementById('observacao').value = '';
        
        // Atualizar status da mesa
        await carregarMesas();
        
        mostrarNotificacao(`✅ Pedido enviado com sucesso!`, 'success');
        
        // Mostrar resumo
        mostrarResumoPedido({ ...pedido, id: data.id });
        
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao('Erro ao enviar pedido', 'error');
    }
}

function mostrarResumoPedido(pedido) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    let itensHtml = '';
    pedido.itens.forEach(item => {
        itensHtml += `
            <tr>
                <td>${item.nome}</td>
                <td>${item.quantidade}x</td>
                <td>${formatarPreco(item.preco * item.quantidade)}</td>
            </tr>
        `;
    });
    
    modal.innerHTML = `
        <div class="modal-header">
            <h2>✅ Pedido Confirmado!</h2>
            <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div style="margin-bottom: 20px;">
            <p><strong>Mesa:</strong> ${state.mesaSelecionada.numero}</p>
            <p><strong>Hora:</strong> ${new Date().toLocaleTimeString()}</p>
            <p><strong>Observação:</strong> ${pedido.observacao || 'Sem observações'}</p>
        </div>
        <table class="table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th>Qtd</th>
                    <th>Subtotal</th>
                </tr>
            </thead>
            <tbody>
                ${itensHtml}
            </tbody>
            <tfoot>
                <tr>
                    <td colspan="2" style="text-align: right;"><strong>Total:</strong></td>
                    <td><strong>${formatarPreco(pedido.total)}</strong></td>
                </tr>
            </tfoot>
        </table>
        <button class="btn btn-primary" style="width: 100%; margin-top: 20px;" 
                onclick="this.closest('.modal-overlay').remove()">
            Fechar
        </button>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
}

// ===== CONFIGURAR EVENTOS =====
function configurarEventos() {
    // Eventos das categorias
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('categoria-btn')) {
            document.querySelectorAll('.categoria-btn').forEach(btn => {
                btn.classList.remove('ativo');
            });
            e.target.classList.add('ativo');
            carregarCardapio(e.target.dataset.categoria);
        }
    });
    
    // Botão enviar
    document.getElementById('btn-enviar').addEventListener('click', enviarPedido);
    
    // Enter no campo observação
    document.getElementById('observacao').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (state.carrinho.length > 0 && state.mesaSelecionada) {
                enviarPedido();
            }
        }
    });
}

// ===== FUNÇÕES GLOBAIS =====
window.removerDoCarrinho = removerDoCarrinho;
window.aumentarQuantidade = aumentarQuantidade;
window.diminuirQuantidade = diminuirQuantidade;
window.entregarPedido = async (pedidoId) => {
    try {
        await fetch(`/api/pedidos/${pedidoId}/entregar`, { method: 'POST' });
        mostrarNotificacao('Pedido entregue!', 'success');
        buscarPedidosProntos();
        carregarMesas();
    } catch (error) {
        console.error('Erro:', error);
    }
};
