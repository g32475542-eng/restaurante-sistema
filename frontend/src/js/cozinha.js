// ===== ESTADO DA APLICAÇÃO =====
let pedidos = {
    pendentes: [],
    preparando: [],
    prontos: []
};

let audioContext = null;
let notificacaoAudio = null;

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando painel da cozinha...');
    
    atualizarRelogio();
    setInterval(atualizarRelogio, 1000);
    
    setupSocket();
    inicializarAudio();
    carregarPedidosIniciais();
});

// ===== ÁUDIO DE NOTIFICAÇÃO =====
function inicializarAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Criar som simples para notificação
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.1;
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    } catch (e) {
        console.log('Áudio não suportado:', e);
    }
}

function tocarNotificacao() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

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
    
    socket.on('novo-pedido', (pedido) => {
        console.log('📦 Novo pedido recebido:', pedido);
        
        // Verificar se já existe
        const existe = pedidos.pendentes.some(p => p.id === pedido.id);
        if (!existe) {
            pedidos.pendentes.unshift(pedido);
            atualizarColunas();
            
            // Notificações
            tocarNotificacao();
            mostrarNotificacao(`🔔 Novo pedido - Mesa ${pedido.mesa}!`, 'info');
            
            // Piscar tela
            document.body.style.backgroundColor = '#444';
            setTimeout(() => {
                document.body.style.backgroundColor = '';
            }, 200);
            
            // Destacar card
            setTimeout(() => {
                const card = document.querySelector(`[data-pedido-id="${pedido.id}"]`);
                if (card) {
                    card.style.animation = 'pulse 0.5s ease';
                    setTimeout(() => {
                        card.style.animation = '';
                    }, 500);
                }
            }, 100);
        }
    });
    
    socket.on('pedido-em-preparo', (pedidoId) => {
        console.log('🔨 Pedido em preparo:', pedidoId);
        
        const index = pedidos.pendentes.findIndex(p => p.id === pedidoId);
        if (index !== -1) {
            const pedido = pedidos.pendentes[index];
            pedido.status = 'preparando';
            pedido.inicioPreparo = new Date();
            
            pedidos.pendentes.splice(index, 1);
            pedidos.preparando.push(pedido);
            atualizarColunas();
        }
    });
    
    socket.on('pedido-para-entrega', (pedidoId) => {
        console.log('✅ Pedido pronto:', pedidoId);
        
        // Procurar em preparando
        const index = pedidos.preparando.findIndex(p => p.id === pedidoId);
        if (index !== -1) {
            const pedido = pedidos.preparando[index];
            pedido.status = 'pronto';
            pedido.fimPreparo = new Date();
            
            pedidos.preparando.splice(index, 1);
            pedidos.prontos.push(pedido);
            atualizarColunas();
            
            mostrarNotificacao(`✅ Pedido da mesa ${pedido.mesa} pronto!`, 'success');
        }
    });
    
    socket.on('pedidos-ativos', (dados) => {
        console.log('📋 Pedidos ativos recebidos:', dados);
        pedidos = dados || { pendentes: [], preparando: [], prontos: [] };
        atualizarColunas();
    });
}

// ===== CARREGAR PEDIDOS INICIAIS =====
async function carregarPedidosIniciais() {
    try {
        const response = await fetch('/api/pedidos/pendentes');
        const dados = await response.json();
        
        // Organizar por status
        pedidos.pendentes = dados.filter(p => p.status === 'pendente');
        pedidos.preparando = dados.filter(p => p.status === 'preparando');
        pedidos.prontos = dados.filter(p => p.status === 'pronto');
        
        atualizarColunas();
        console.log('📋 Pedidos carregados:', pedidos);
    } catch (error) {
        console.error('Erro ao carregar pedidos:', error);
    }
}

// ===== ATUALIZAR INTERFACE =====
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
    
    if (pedidos.pendentes.length === 0) {
        coluna.innerHTML = '<div class="vazio-message">📭 Nenhum pedido pendente</div>';
        return;
    }
    
    // Ordenar por hora (mais recentes primeiro)
    const ordenados = [...pedidos.pendentes].sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
    );
    
    ordenados.forEach(pedido => {
        coluna.appendChild(criarCardPedido(pedido, 'pendente'));
    });
}

function atualizarColunaPreparando() {
    const coluna = document.getElementById('preparando-lista');
    if (!coluna) return;
    
    coluna.innerHTML = '';
    
    if (pedidos.preparando.length === 0) {
        coluna.innerHTML = '<div class="vazio-message">🔨 Nenhum pedido em preparo</div>';
        return;
    }
    
    pedidos.preparando.forEach(pedido => {
        coluna.appendChild(criarCardPedido(pedido, 'preparando'));
    });
}

function atualizarColunaProntos() {
    const coluna = document.getElementById('prontos-lista');
    if (!coluna) return;
    
    coluna.innerHTML = '';
    
    if (pedidos.prontos.length === 0) {
        coluna.innerHTML = '<div class="vazio-message">✅ Nenhum pedido pronto</div>';
        return;
    }
    
    pedidos.prontos.forEach(pedido => {
        coluna.appendChild(criarCardPedido(pedido, 'pronto'));
    });
}

function atualizarContadores() {
    document.getElementById('pedidos-pendentes').textContent = `⏳ Pendentes: ${pedidos.pendentes.length}`;
    document.getElementById('pedidos-preparando').textContent = `🔨 Preparando: ${pedidos.preparando.length}`;
    document.getElementById('pedidos-prontos').textContent = `✅ Prontos: ${pedidos.prontos.length}`;
    
    document.getElementById('pendentes-count').textContent = pedidos.pendentes.length;
    document.getElementById('preparando-count').textContent = pedidos.preparando.length;
    document.getElementById('prontos-count').textContent = pedidos.prontos.length;
}

function atualizarRelogio() {
    const agora = new Date();
    const hora = agora.toLocaleTimeString('pt-BR');
    document.getElementById('hora-atual').textContent = `🕐 ${hora}`;
}

// ===== CRIAR CARD DO PEDIDO =====
function criarCardPedido(pedido, status) {
    const card = document.createElement('div');
    card.className = `pedido-card ${status}`;
    card.dataset.pedidoId = pedido.id;
    
    const tempo = calcularTempoPedido(pedido.created_at);
    const tempoClass = tempo.includes('⚠️') ? 'tempo-pedido atrasado' : 'tempo-pedido';
    
    // Itens do pedido
    let itensHtml = '';
    if (pedido.itens && pedido.itens.length > 0) {
        pedido.itens.forEach(item => {
            itensHtml += `
                <div class="item">
                    <span>${item.quantidade}x ${item.nome}</span>
                    <span>${formatarPreco(item.preco * item.quantidade)}</span>
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
                <span style="flex:1; text-align:center; color: var(--success); font-weight:600;">
                    ⏰ Aguardando garçom
                </span>
            </div>
        `;
    }
    
    card.innerHTML = `
        <div class="pedido-header">
            <span class="mesa-numero">Mesa ${pedido.mesa_numero || pedido.mesa}</span>
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
    
    const agora = new Date();
    const pedidoTime = new Date(dataPedido);
    const diffMs = agora - pedidoTime;
    const diffMin = Math.floor(diffMs / 60000);
    
    if (diffMin < 1) return 'Agora';
    if (diffMin === 1) return '1 min';
    if (diffMin > 20) return `${diffMin} min ⚠️`;
    return `${diffMin} min`;
}

// ===== AÇÕES DOS PEDIDOS =====
window.iniciarPreparo = (pedidoId) => {
    console.log('▶️ Iniciar preparo:', pedidoId);
    
    if (typeof socket !== 'undefined') {
        socket.emit('iniciar-preparo', pedidoId);
        mostrarNotificacao('Preparo iniciado!', 'info');
        
        // Feedback visual
        const card = document.querySelector(`[data-pedido-id="${pedidoId}"]`);
        if (card) {
            card.style.background = '#fff3cd';
            setTimeout(() => {
                card.style.background = '';
            }, 300);
        }
    }
};

window.finalizarPreparo = (pedidoId) => {
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
        carregarPedidosIniciais();
        mostrarNotificacao('Pedidos recarregados', 'info');
    }
    
    // Ctrl+Space para testar notificação
    if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        mostrarNotificacao('🔔 Notificação de teste!', 'info');
        tocarNotificacao();
    }
});

// ===== LIMPEZA DE PEDIDOS ANTIGOS =====
setInterval(() => {
    // Remover pedidos prontos com mais de 30 minutos
    const trintaMinutosAtras = new Date(Date.now() - 30 * 60000);
    
    pedidos.prontos = pedidos.prontos.filter(pedido => {
        const dataPedido = new Date(pedido.created_at);
        return dataPedido > trintaMinutosAtras;
    });
    
    atualizarColunaProntos();
}, 60000); // A cada minuto
