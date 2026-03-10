// ===== CONTROLE DE AUTENTICAÇÃO GLOBAL =====

// Verificar se usuário está logado
async function verificarAutenticacao() {
    try {
        const response = await fetch('/api/me');
        if (!response.ok) {
            window.location.href = '/';
            return null;
        }
        return await response.json();
    } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        window.location.href = '/';
        return null;
    }
}

// Logout
async function logout() {
    try {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/';
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
    }
}

// Mostrar notificação
function mostrarNotificacao(mensagem, tipo = 'info') {
    const notificacao = document.createElement('div');
    notificacao.className = `notification ${tipo}`;
    notificacao.textContent = mensagem;
    document.body.appendChild(notificacao);
    
    setTimeout(() => {
        notificacao.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notificacao.remove(), 300);
    }, 3000);
}

// Formatar preço
function formatarPreco(valor) {
    return valor.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

// Formatar data
function formatarData(data) {
    return new Date(data).toLocaleString('pt-BR');
}

// Loading overlay
function mostrarLoading() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = '<div class="loading"></div>';
    document.body.appendChild(overlay);
    return overlay;
}

// Funções globais
window.logout = logout;
window.mostrarNotificacao = mostrarNotificacao;
window.formatarPreco = formatarPreco;
window.formatarData = formatarData;

// Verificar autenticação ao carregar página
document.addEventListener('DOMContentLoaded', async () => {
    // Ignorar na página de login
    if (!window.location.pathname.includes('login.html') && window.location.pathname !== '/') {
        const user = await verificarAutenticacao();
        if (user) {
            console.log(`✅ Usuário autenticado: ${user.nome} (${user.tipo})`);
            
            // Adicionar nome do usuário no header se existir
            const userSpan = document.getElementById('usuario-nome');
            if (userSpan) userSpan.textContent = user.nome;
        }
    }
});
