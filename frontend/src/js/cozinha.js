// ===== ESTADO DA APLICAÇÃO =====
let pedidos = {
    pendentes: [],
    preparando: [],
    prontos: []
};

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando cozinha...');
    
    atualizarRelogio();
    setInterval(atualizarRelogio, 1000);
    
    setupSocket();
    adicionarEstilosGlobais();
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
        socket.emit('solicitar-pedidos');
    });
    
    socket.on('pedidos-ativos', (dados) => {
        console.log('📋 Pedidos ativos recebidos:', dados);
        
        // Garantir que dados existe e tem a estrutura correta
        if (dados && Array.isArray(dados)) {
            // Separar pedidos por status
            pedidos.pendentes = dados.filter(p => p && p.status === 'pendente') || [];
            pedidos.preparando = dados.filter(p => p && p.status === 'preparando') || [];
            pedidos.prontos = dados.filter(p => p && p.status === 'pronto') || [];
        } else {
            console.log('📋 Nenhum pedido ativo');
            pedidos.pendentes = [];
            pedidos.preparando = [];
            pedidos.prontos = [];
        }
        
        atualizarColunas();
    });
    
    socket.on('novo-pedido', (pedido) => {
        console.log('📦 Novo pedido recebido:', pedido);
        
        if (!pedido || !pedido.id) return;
        
        // Verificar se já não existe
        const existe = pedidos.pendentes.some(p => p && p.id === pedido.id);
        if (!existe) {
            pedidos.pendentes.unshift(pedido);
            atualizarColunas();
            
            mostrarNotificacao(`🔔 Novo pedido - Mesa ${pedido.mesa}!`, 'info');
            
            // Piscar tela
            document.body.style.backgroundColor = '#444';
            setTimeout(() => {
                document.body.style.backgroundColor = '';
            }, 200);
        }
    });
    
    socket.on('pedido-em-preparo', (pedidoId) => {
        console.log('🔨 Pedido em preparo:', pedidoId);
        
        if (!pedidoId) return;
        
        // Mover de pendentes para preparando
        const index = pedidos.pendentes.findIndex(p => p && p.id === pedidoId);
        if (index !== -1) {
            const pedido = pedidos.pendentes[index];
            pedido.status = 'preparando';
            pedido.inicioPreparo = new Date();
            
            pedidos.pendentes.splice(index, 1);
            pedidos.preparando.push(pedido);
            atualizarColunas();
            mostrarNotificacao(`🔨 Pedido Mesa ${pedido.mesa} em preparo`, 'info');
        }
    });
    
    socket.on('pedido-para-entrega', (pedidoId) => {
        console.log('✅ Pedido pronto:', pedidoId);
        
        if (!pedidoId) return;
        
        // Procurar em preparando
        const index = pedidos.preparando.findIndex(p => p && p.id === pedidoId);
        if (index !== -1) {
            const pedido = pedidos.preparando[index];
            pedido.status = 'pronto';
            pedido.fimPreparo = new Date();
            
            pedidos.preparando.splice(index, 1);
            pedidos.prontos.push(pedido);
            atualizarColunas();
            mostrarNotificacao(`✅ Pedido Mesa ${pedido.mesa} pronto!`, 'success');
        }
    });
    
    socket.on('pedido-entregue', (pedidoId) => {
        console.log('🍽️ Pedido entregue:', pedidoId);
        
        if (!pedidoId) return;
        
        const index = pedidos.prontos.findIndex(p => p && p.id === pedidoId);
        if (index !== -1) {
            pedidos.prontos.splice(index, 1);
            atualizarColunas();
        }
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Desconectado do servidor');
        mostrarNotificacao('Desconectado do servidor', 'error');
    });
}

// ===== ATUALIZAR COLUNAS =====
function atualizarColunas() {
    atualizarColunaPendentes();
    atualizarColunaPreparando();
    atualizarColunaProntos();
    atualizarContadores();
}

function atualizarColunaPendentes() {
    const coluna = document.getElementById('pendentes-lista');
    if (!coluna) return;
    
    coluna.innerHTML = '';
    
    if (!pedidos.pendentes || pedidos.pendentes.length === 0) {
        coluna.innerHTML = '<div class="vazio-message">📭 Nenhum pedido pendente</div>';
        return;
    }
    
    // Ordenar por hora (mais recentes primeiro)
    const ordenados = [...pedidos.pendentes].sort((a, b) => {
        if (!a || !b) return 0;
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });
    
    ordenados.forEach(pedido => {
        if (pedido) coluna.appendChild(criarCardPedido(pedido, 'pendente'));
    });
}

function atualizarColunaPreparando() {
    const coluna = document.getElementById('preparando-lista');
    if (!coluna) return;
    
    coluna.innerHTML = '';
    
    if (!pedidos.preparando || pedidos.preparando.length === 0) {
        coluna.innerHTML = '<div class="vazio-message">🔨 Nenhum pedido em preparo</div>';
        return;
    }
    
    pedidos.preparando.forEach(pedido => {
        if (pedido) coluna.appendChild(criarCardPedido(pedido, 'preparando'));
    });
}

function atualizarColunaProntos() {
    const coluna = document.getElementById('prontos-lista');
    if (!coluna) return;
    
    coluna.innerHTML = '';
    
    if (!pedidos.prontos || pedidos.prontos.length === 0) {
        coluna.innerHTML = '<div class="vazio-message">✅ Nenhum pedido pronto</div>';
        return;
    }
    
    pedidos.prontos.forEach(pedido => {
        if (pedido) coluna.appendChild(criarCardPedido(pedido, 'pronto'));
    });
}

function atualizarContadores() {
    const pendentesEl = document.getElementById('pedidos-pendentes');
    const preparandoEl = document.getElementById('pedidos-preparando');
    const prontosEl = document.getElementById('pedidos-prontos');
    
    const pendentesCount = pedidos.pendentes?.length || 0;
    const preparandoCount = pedidos.preparando?.length || 0;
    const prontosCount = pedidos.prontos?.length || 0;
    
    if (pendentesEl) pendentesEl.textContent = `⏳ Pendentes: ${pendentesCount}`;
    if (preparandoEl) preparandoEl.textContent = `🔨 Preparando: ${preparandoCount}`;
    if (prontosEl) prontosEl.textContent = `✅ Prontos: ${prontosCount}`;
    
    document.getElementById('pendentes-count').textContent = pendentesCount;
    document.getElementById('preparando-count').textContent = preparandoCount;
    document.getElementById('prontos-count').textContent = prontosCount;
}

function atualizarRelogio() {
    const agora = new Date();
    const hora = agora.toLocaleTimeString('pt-BR');
    const relogio = document.getElementById('hora-atual');
    if (relogio) {
        relogio.textContent = `🕐 ${hora}`;
    }
}

// ===== CRIAR CARD DO PEDIDO =====
function criarCardPedido(pedido, status) {
    if (!pedido) return document.createElement('div');
    
    const card = document.createElement('div');
    card.className = `pedido-card ${status}`;
    card.dataset.pedidoId = pedido.id || '';
    
    const tempo = calcularTempoPedido(pedido.created_at);
    const tempoClass = tempo.includes('⚠️') ? 'tempo-pedido atrasado' : 'tempo-pedido';
    
    // Itens do pedido
    let itensHtml = '';
    if (pedido.itens && pedido.itens.length > 0) {
        pedido.itens.forEach(item => {
            if (!item) return;
            const qtd = item.quantidade || 1;
            const preco = item.preco || 0;
            itensHtml += `
                <div class="item">
                    <span>${qtd}x ${item.nome || 'Item'}</span>
                    <span>R$ ${(preco * qtd).toFixed(2)}</span>
                </div>
            `;
        });
    } else {
        itensHtml = '<div class="item">Carregando itens...</div>';
    }
    
    // Observação
    let observacaoHtml = '';
    if (pedido.observacao && pedido.observacao.trim() !== '') {
        observacaoHtml = `<div class="observacao">📝 ${pedido.observacao}</div>`;
    }
    
    // Botões de ação
    let botoesHtml = '';
    if (status === 'pendente') {
        botoesHtml = `
            <div class="acoes-pedido">
                <button class="btn-acao btn-iniciar" onclick="iniciarPreparo('${pedido.id}')">
                    🔨 Iniciar Preparo
                </button>
            </div>
        `;
    } else if (status === 'preparando') {
        botoesHtml = `
            <div class="acoes-pedido">
                <button class="btn-acao btn-pronto" onclick="finalizarPreparo('${pedido.id}')">
                    ✅ Pronto!
                </button>
            </div>
        `;
    } else if (status === 'pronto') {
        botoesHtml = `
            <div class="acoes-pedido">
                <span style="flex:1; text-align:center; color: #4CAF50; font-weight:600;">
                    ⏰ Aguardando garçom
                </span>
            </div>
        `;
    }
    
    card.innerHTML = `
        <div class="pedido-header">
            <span class="mesa-numero">Mesa ${pedido.mesa_numero || pedido.mesa || '?'}</span>
            <span class="${tempoClass}">⏱️ ${tempo}</span>
        </div>
        <div class="pedido-info">
            <div class="garcom-nome">👤 Garçom: ${pedido.garcom_nome || 'Não identificado'}</div>
            <div class="itens-pedido">
                ${itensHtml}
            </div>
            ${observacaoHtml}
        </div>
        ${botoesHtml}
    `;
    
    return card;
}

// ===== CALCULAR TEMPO =====
function calcularTempoPedido(dataPedido) {
    if (!dataPedido) return '0 min';
    
    try {
        const agora = new Date();
        const pedidoTime = new Date(dataPedido);
        const diffMs = agora - pedidoTime;
        const diffMin = Math.floor(diffMs / 60000);
        
        if (diffMin < 1) return 'Agora';
        if (diffMin === 1) return '1 min';
        if (diffMin > 20) return `${diffMin} min ⚠️`;
        return `${diffMin} min`;
    } catch (e) {
        return '0 min';
    }
}

// ===== FUNÇÕES AUXILIARES =====
function adicionarEstilosGlobais() {
    const style = document.createElement('style');
    style.textContent = `
        .vazio-message {
            text-align: center;
            padding: 40px 20px;
            color: #999;
            background: white;
            border-radius: 8px;
            border: 2px dashed #ddd;
            margin: 10px 0;
        }
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            animation: slideIn 0.3s ease;
            z-index: 9999;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .notification.success { background: #4CAF50; }
        .notification.error { background: #f44336; }
        .notification.info { background: #FF9800; }
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

function mostrarNotificacao(mensagem, tipo = 'info') {
    const notificacoesAntigas = document.querySelectorAll('.notification');
    notificacoesAntigas.forEach(n => n.remove());
    
    const notificacao = document.createElement('div');
    notificacao.className = `notification ${tipo}`;
    notificacao.textContent = mensagem;
    document.body.appendChild(notificacao);
    
    setTimeout(() => {
        notificacao.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notificacao.remove(), 300);
    }, 3000);
}

// ===== AÇÕES DOS PEDIDOS =====
window.iniciarPreparo = (pedidoId) => {
    if (!pedidoId) return;
    console.log('▶️ Iniciar preparo:', pedidoId);
    
    if (typeof socket !== 'undefined') {
        socket.emit('iniciar-preparo', pedidoId);
        mostrarNotificacao('Preparo iniciado!', 'info');
    }
};

window.finalizarPreparo = (pedidoId) => {
    if (!pedidoId) return;
    console.log('✅ Finalizar preparo:', pedidoId);
    
    if (typeof socket !== 'undefined') {
        socket.emit('pedido-pronto', pedidoId);
        mostrarNotificacao('Pedido marcado como pronto!', 'success');
    }
};

// ===== ATALHOS DE TECLADO =====
document.addEventListener('keydown', (e) => {
    // F5 para recarregar pedidos
    if (e.key === 'F5') {
        e.preventDefault();
        if (typeof socket !== 'undefined') {
            socket.emit('solicitar-pedidos');
            mostrarNotificacao('Pedidos recarregados', 'info');
        }
    }
});

// ===== LIMPEZA DE PEDIDOS ANTIGOS =====
setInterval(() => {
    if (pedidos.prontos && pedidos.prontos.length > 0) {
        const trintaMinutosAtras = new Date(Date.now() - 30 * 60000);
        
        pedidos.prontos = pedidos.prontos.filter(pedido => {
            if (!pedido || !pedido.created_at) return true;
            const dataPedido = new Date(pedido.created_at);
            return dataPedido > trintaMinutosAtras;
        });
        
        atualizarColunaProntos();
    }
}, 60000);
