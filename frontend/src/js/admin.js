// ===== ESTADO DA APLICAÇÃO =====
let state = {
    categorias: [],
    cardapio: [],
    mesas: [],
    usuarios: [],
    config: {},
    stats: {
        faturamento: 0,
        pedidos: 0,
        clientes: 0,
        tempoMedio: 0
    }
};

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Inicializando painel administrativo...');
    carregarTudo();
    configurarEventos();
    configurarBuscas();
});

// ===== CARREGAR TODOS OS DADOS =====
async function carregarTudo() {
    try {
        await Promise.all([
            carregarCategorias(),
            carregarCardapio(),
            carregarMesas(),
            carregarUsuarios(),
            carregarStats(),
            carregarConfig()
        ]);
        console.log('✅ Todos os dados carregados');
        mostrarNotificacao('Dados carregados com sucesso!', 'success');
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        mostrarNotificacao('Erro ao carregar dados', 'error');
    }
}

// ===== CATEGORIAS =====
async function carregarCategorias() {
    try {
        const response = await fetch('/api/categorias');
        state.categorias = await response.json();
        atualizarTabelaCategorias();
        atualizarSelectCategorias();
        console.log('📋 Categorias carregadas:', state.categorias.length);
    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
    }
}

function atualizarTabelaCategorias() {
    const tbody = document.getElementById('categorias-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    state.categorias.forEach(cat => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${cat.id}</td>
            <td style="font-size: 1.5rem;">${cat.icone || '📋'}</td>
            <td>${cat.nome}</td>
            <td>
                <div style="width: 30px; height: 30px; border-radius: 50%; background: ${cat.cor};"></div>
            </td>
            <td>${cat.ordem || 0}</td>
            <td>
                <span class="status-badge ${cat.ativo ? 'ativo' : 'inativo'}">
                    ${cat.ativo ? 'Ativo' : 'Inativo'}
                </span>
            </td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon btn-edit" onclick="editarCategoria(${cat.id})">✏️</button>
                    <button class="btn-icon btn-toggle" onclick="toggleCategoria(${cat.id})">
                        ${cat.ativo ? '🔴' : '🟢'}
                    </button>
                    <button class="btn-icon btn-delete" onclick="excluirCategoria(${cat.id})">🗑️</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function atualizarSelectCategorias() {
    const select = document.getElementById('item-categoria');
    if (!select) return;
    
    select.innerHTML = '<option value="">Selecione...</option>';
    
    state.categorias
        .filter(cat => cat.ativo)
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
        .forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = `${cat.icone || '📋'} ${cat.nome}`;
            select.appendChild(option);
        });
}

// Evento do formulário de categoria
document.getElementById('form-categoria')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nome = document.getElementById('cat-nome')?.value;
    if (!nome) {
        mostrarNotificacao('Nome da categoria é obrigatório!', 'error');
        return;
    }
    
    const categoria = {
        nome: nome,
        icone: document.getElementById('cat-icone')?.value || '📋',
        cor: document.getElementById('cat-cor')?.value || '#4CAF50',
        ordem: parseInt(document.getElementById('cat-ordem')?.value) || 0
    };
    
    try {
        const response = await fetch('/api/categorias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(categoria)
        });
        
        if (!response.ok) {
            const erro = await response.json();
            throw new Error(erro.erro || 'Erro ao salvar');
        }
        
        mostrarNotificacao('Categoria criada com sucesso!', 'success');
        limparFormCategoria();
        await carregarCategorias();
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao('Erro ao criar categoria: ' + error.message, 'error');
    }
});

window.editarCategoria = (id) => {
    const cat = state.categorias.find(c => c.id === id);
    if (!cat) return;
    
    document.getElementById('cat-nome').value = cat.nome;
    document.getElementById('cat-icone').value = cat.icone || '📋';
    document.getElementById('cat-cor').value = cat.cor || '#4CAF50';
    document.getElementById('cat-ordem').value = cat.ordem || 0;
    
    document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth' });
};

window.toggleCategoria = async (id) => {
    const cat = state.categorias.find(c => c.id === id);
    if (!cat) return;
    
    try {
        const response = await fetch(`/api/categorias/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...cat, ativo: !cat.ativo })
        });
        
        if (!response.ok) throw new Error('Erro ao atualizar');
        
        mostrarNotificacao(`Categoria ${cat.ativo ? 'desativada' : 'ativada'}!`, 'success');
        await carregarCategorias();
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao('Erro ao atualizar categoria', 'error');
    }
};

window.excluirCategoria = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;
    
    try {
        const response = await fetch(`/api/categorias/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Erro ao excluir');
        
        mostrarNotificacao('Categoria excluída!', 'success');
        await carregarCategorias();
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao('Erro ao excluir categoria', 'error');
    }
};

window.limparFormCategoria = () => {
    document.getElementById('cat-nome').value = '';
    document.getElementById('cat-icone').value = '📋';
    document.getElementById('cat-cor').value = '#4CAF50';
    document.getElementById('cat-ordem').value = '0';
};

// ===== CARDÁPIO =====
async function carregarCardapio() {
    try {
        const response = await fetch('/api/cardapio');
        state.cardapio = await response.json();
        atualizarTabelaCardapio();
        console.log('🍽️ Cardápio carregado:', state.cardapio.length);
    } catch (error) {
        console.error('Erro ao carregar cardápio:', error);
    }
}

function atualizarTabelaCardapio() {
    const tbody = document.getElementById('cardapio-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    state.cardapio.forEach(item => {
        const categoria = state.categorias.find(c => c.id === item.categoria_id);
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.id}</td>
            <td>${item.nome}</td>
            <td>${categoria ? `${categoria.icone} ${categoria.nome}` : 'Sem categoria'}</td>
            <td>R$ ${parseFloat(item.preco).toFixed(2)}</td>
            <td>${item.tempo_preparo || 15} min</td>
            <td>
                <span class="status-badge ${item.disponivel ? 'ativo' : 'inativo'}">
                    ${item.disponivel ? 'Disponível' : 'Indisponível'}
                </span>
            </td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon btn-edit" onclick="editarItem(${item.id})">✏️</button>
                    <button class="btn-icon btn-toggle" onclick="toggleItem(${item.id})">
                        ${item.disponivel ? '🔴' : '🟢'}
                    </button>
                    <button class="btn-icon btn-delete" onclick="excluirItem(${item.id})">🗑️</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Evento do formulário de item
document.getElementById('form-item')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nome = document.getElementById('item-nome')?.value;
    const preco = document.getElementById('item-preco')?.value;
    const categoria_id = document.getElementById('item-categoria')?.value;
    
    if (!nome || !preco || !categoria_id) {
        mostrarNotificacao('Nome, preço e categoria são obrigatórios!', 'error');
        return;
    }
    
    const item = {
        id: document.getElementById('item-id')?.value,
        nome: nome,
        preco: parseFloat(preco),
        categoria_id: parseInt(categoria_id),
        descricao: document.getElementById('item-descricao')?.value || '',
        tempo_preparo: parseInt(document.getElementById('item-tempo')?.value) || 15
    };
    
    try {
        const url = item.id ? `/api/cardapio/${item.id}` : '/api/cardapio';
        const method = item.id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item)
        });
        
        if (!response.ok) {
            const erro = await response.json();
            throw new Error(erro.erro || 'Erro ao salvar');
        }
        
        mostrarNotificacao(`Item ${item.id ? 'atualizado' : 'criado'} com sucesso!`, 'success');
        limparFormItem();
        await carregarCardapio();
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao('Erro ao salvar item: ' + error.message, 'error');
    }
});

window.editarItem = (id) => {
    const item = state.cardapio.find(i => i.id === id);
    if (!item) return;
    
    document.getElementById('item-id').value = item.id;
    document.getElementById('item-nome').value = item.nome;
    document.getElementById('item-preco').value = item.preco;
    document.getElementById('item-categoria').value = item.categoria_id;
    document.getElementById('item-descricao').value = item.descricao || '';
    document.getElementById('item-tempo').value = item.tempo_preparo || 15;
    
    document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth' });
};

window.toggleItem = async (id) => {
    const item = state.cardapio.find(i => i.id === id);
    if (!item) return;
    
    try {
        const response = await fetch(`/api/cardapio/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...item, disponivel: !item.disponivel })
        });
        
        if (!response.ok) throw new Error('Erro ao atualizar');
        
        mostrarNotificacao(`Item ${item.disponivel ? 'indisponível' : 'disponível'}!`, 'success');
        await carregarCardapio();
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao('Erro ao atualizar item', 'error');
    }
};

window.excluirItem = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;
    
    try {
        const response = await fetch(`/api/cardapio/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Erro ao excluir');
        
        mostrarNotificacao('Item excluído!', 'success');
        await carregarCardapio();
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao('Erro ao excluir item', 'error');
    }
};

window.limparFormItem = () => {
    document.getElementById('item-id').value = '';
    document.getElementById('item-nome').value = '';
    document.getElementById('item-preco').value = '';
    document.getElementById('item-categoria').value = '';
    document.getElementById('item-descricao').value = '';
    document.getElementById('item-tempo').value = '15';
};

// ===== MESAS =====
async function carregarMesas() {
    try {
        const response = await fetch('/api/mesas');
        state.mesas = await response.json();
        atualizarGridMesas();
        console.log('🪑 Mesas carregadas:', state.mesas.length);
    } catch (error) {
        console.error('Erro ao carregar mesas:', error);
    }
}

function atualizarGridMesas() {
    const grid = document.getElementById('mesas-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    state.mesas
        .sort((a, b) => a.numero - b.numero)
        .forEach(mesa => {
            const card = document.createElement('div');
            card.className = 'categoria-card';
            card.innerHTML = `
                <div class="categoria-icone">🪑</div>
                <div class="categoria-nome">Mesa ${mesa.numero}</div>
                <div class="categoria-cor" style="background: ${mesa.status === 'ocupada' ? '#ff9800' : '#4CAF50'};"></div>
                <div style="margin-top: 10px;">
                    <span class="status-badge ${mesa.status === 'ocupada' ? 'inativo' : 'ativo'}">
                        ${mesa.status === 'ocupada' ? '👥 Ocupada' : '✅ Livre'}
                    </span>
                </div>
                <div style="margin-top: 15px;">
                    <button class="btn-icon btn-edit" onclick="editarMesa(${mesa.id})">✏️</button>
                    <button class="btn-icon btn-delete" onclick="excluirMesa(${mesa.id})">🗑️</button>
                </div>
            `;
            grid.appendChild(card);
        });
}

// Evento do formulário de mesa
document.getElementById('form-mesa')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const numero = document.getElementById('mesa-numero')?.value;
    
    if (!numero) {
        mostrarNotificacao('Número da mesa é obrigatório!', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/mesas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numero: parseInt(numero) })
        });
        
        if (!response.ok) {
            const erro = await response.json();
            throw new Error(erro.erro || 'Erro ao criar mesa');
        }
        
        mostrarNotificacao('Mesa criada com sucesso!', 'success');
        document.getElementById('mesa-numero').value = '';
        await carregarMesas();
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao('Erro ao criar mesa: ' + error.message, 'error');
    }
});

window.editarMesa = async (id) => {
    // Implementar edição de mesa se necessário
    console.log('Editar mesa:', id);
};

window.excluirMesa = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta mesa?')) return;
    
    try {
        const response = await fetch(`/api/mesas/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Erro ao excluir');
        
        mostrarNotificacao('Mesa excluída!', 'success');
        await carregarMesas();
    } catch (error) {
        console.error('Erro:', error);
        mostrarNotificacao('Erro ao excluir mesa', 'error');
    }
};

// ===== USUÁRIOS =====
async function carregarUsuarios() {
    try {
        const response = await fetch('/api/usuarios');
        if (!response.ok) throw new Error('Erro ao carregar usuários');
        state.usuarios = await response.json();
        atualizarTabelaUsuarios();
        console.log('👥 Usuários carregados:', state.usuarios.length);
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        mostrarNotificacao('Erro ao carregar usuários', 'error');
    }
}

function atualizarTabelaUsuarios() {
    const tbody = document.getElementById('usuarios-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    state.usuarios.forEach(user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${user.id}</td>
            <td>${user.nome}</td>
            <td>${user.usuario}</td>
            <td>
                <span class="status-badge" style="background: ${getTipoColor(user.tipo)};">
                    ${getTipoIcon(user.tipo)} ${user.tipo}
                </span>
            </td>
            <td>${new Date(user.created_at).toLocaleDateString('pt-BR')}</td>
            <td>
                <div class="action-btns">
                    <button class="btn-icon btn-edit" onclick="editarUsuario(${user.id})">✏️</button>
                    <button class="btn-icon btn-delete" onclick="excluirUsuario(${user.id})" ${user.id === 1 ? 'disabled style="opacity:0.5"' : ''}>
                        🗑️
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function getTipoColor(tipo) {
    switch(tipo) {
        case 'admin': return '#ffcdd2';
        case 'garcom': return '#c8e6c9';
        case 'cozinha': return '#fff3cd';
        default: return '#e0e0e0';
    }
}

function getTipoIcon(tipo) {
    switch(tipo) {
        case 'admin': return '⚙️';
        case 'garcom': return '👨‍🍳';
        case 'cozinha': return '👩‍🍳';
        default: return '👤';
    }
}

// Evento do formulário de usuário - VERSÃO CORRIGIDA COM ALERT SIMPLES
document.getElementById('form-usuario')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Pegar valores dos campos
    const id = document.getElementById('usuario-id')?.value;
    const nome = document.getElementById('usuario-nome')?.value;
    const usuario = document.getElementById('usuario-login')?.value;
    const senha = document.getElementById('usuario-senha')?.value;
    const tipo = document.getElementById('usuario-tipo')?.value;

    // VALIDAÇÕES SIMPLES
    if (!nome || nome.trim() === '') {
        alert('⚠️ Nome é obrigatório!');
        return;
    }

    if (!usuario || usuario.trim() === '') {
        alert('⚠️ Usuário é obrigatório!');
        return;
    }

    if (!tipo) {
        alert('⚠️ Tipo de usuário é obrigatório!');
        return;
    }

    if (!id && (!senha || senha.trim() === '')) {
        alert('⚠️ Senha é obrigatória para novo usuário!');
        return;
    }

    // Montar objeto
    const dados = {
        nome: nome.trim(),
        usuario: usuario.trim(),
        tipo: tipo
    };

    if (senha && senha.trim() !== '') {
        dados.senha = senha.trim();
    }

    try {
        const url = id ? `/api/usuarios/${id}` : '/api/usuarios';
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        const respostaData = await response.json();

        if (!response.ok) {
            throw new Error(respostaData.erro || 'Erro ao salvar');
        }

        alert('✅ Usuário salvo com sucesso!');
        
        // Limpar formulário
        document.getElementById('usuario-id').value = '';
        document.getElementById('usuario-nome').value = '';
        document.getElementById('usuario-login').value = '';
        document.getElementById('usuario-senha').value = '';
        document.getElementById('usuario-tipo').value = 'garcom';
        
        await carregarUsuarios();
        
    } catch (error) {
        console.error('❌ Erro:', error);
        alert('❌ Erro: ' + error.message);
    }
});

window.editarUsuario = (id) => {
    const user = state.usuarios.find(u => u.id === id);
    if (!user) return;
    
    document.getElementById('usuario-id').value = user.id;
    document.getElementById('usuario-nome').value = user.nome;
    document.getElementById('usuario-login').value = user.usuario;
    document.getElementById('usuario-senha').value = '';
    document.getElementById('usuario-tipo').value = user.tipo;
    
    document.querySelector('.form-panel').scrollIntoView({ behavior: 'smooth' });
};

window.excluirUsuario = async (id) => {
    if (id === 1) {
        alert('❌ Não é possível excluir o administrador principal');
        return;
    }
    
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;
    
    try {
        const response = await fetch(`/api/usuarios/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const erro = await response.json();
            throw new Error(erro.erro || 'Erro ao excluir');
        }
        
        alert('✅ Usuário excluído!');
        await carregarUsuarios();
    } catch (error) {
        console.error('Erro:', error);
        alert('❌ Erro: ' + error.message);
    }
};

window.limparFormUsuario = () => {
    document.getElementById('usuario-id').value = '';
    document.getElementById('usuario-nome').value = '';
    document.getElementById('usuario-login').value = '';
    document.getElementById('usuario-senha').value = '';
    document.getElementById('usuario-tipo').value = 'garcom';
};

// ===== ESTATÍSTICAS =====
async function carregarStats() {
    try {
        const response = await fetch('/api/stats');
        if (response.ok) {
            state.stats = await response.json();
            atualizarStats();
        }
    } catch (error) {
        console.error('Erro ao carregar stats:', error);
    }
}

function atualizarStats() {
    document.getElementById('stats-faturamento').textContent = `R$ ${(state.stats.faturamento || 0).toFixed(2)}`;
    document.getElementById('stats-pedidos').textContent = state.stats.pedidos || 0;
    document.getElementById('stats-clientes').textContent = state.stats.clientes || 0;
    document.getElementById('stats-tempo').textContent = state.stats.tempoMedio || 0;
}

// ===== CONFIGURAÇÕES =====
async function carregarConfig() {
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            state.config = await response.json();
            atualizarConfig();
        }
    } catch (error) {
        console.error('Erro ao carregar config:', error);
    }
}

function atualizarConfig() {
    document.getElementById('config-nome').value = state.config.nome_restaurante || 'Meu Restaurante';
    document.getElementById('config-tempo').value = state.config.tempo_medio || 30;
    document.getElementById('config-cor-primaria').value = state.config.cor_primaria || '#4CAF50';
    document.getElementById('config-cor-secundaria').value = state.config.cor_secundaria || '#FF9800';
}

// Evento do formulário de config
document.getElementById('form-config')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const config = {
        nome_restaurante: document.getElementById('config-nome').value,
        tempo_medio: parseInt(document.getElementById('config-tempo').value) || 30,
        cor_primaria: document.getElementById('config-cor-primaria').value,
        cor_secundaria: document.getElementById('config-cor-secundaria').value
    };
    
    try {
        const response = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        
        if (!response.ok) throw new Error('Erro ao salvar');
        
        alert('✅ Configurações salvas!');
        
        document.documentElement.style.setProperty('--primary', config.cor_primaria);
        document.documentElement.style.setProperty('--secondary', config.cor_secundaria);
        
    } catch (error) {
        console.error('Erro:', error);
        alert('❌ Erro ao salvar configurações');
    }
});

// ===== CONFIGURAÇÕES GERAIS =====
function configurarEventos() {
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('ativo'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('ativo'));
            
            btn.classList.add('ativo');
            const tabId = btn.dataset.tab;
            const tabPane = document.getElementById(`tab-${tabId}`);
            if (tabPane) tabPane.classList.add('ativo');
            
            // Recarregar dados da tab
            if (tabId === 'categorias') carregarCategorias();
            if (tabId === 'cardapio') carregarCardapio();
            if (tabId === 'usuarios') carregarUsuarios();
            if (tabId === 'dashboard') carregarStats();
        });
    });
}

function configurarBuscas() {
    // Busca em categorias
    document.getElementById('search-categorias')?.addEventListener('input', (e) => {
        const termo = e.target.value.toLowerCase();
        const linhas = document.querySelectorAll('#categorias-table-body tr');
        
        linhas.forEach(linha => {
            const texto = linha.textContent.toLowerCase();
            linha.style.display = texto.includes(termo) ? '' : 'none';
        });
    });
    
    // Busca em cardápio
    document.getElementById('search-cardapio')?.addEventListener('input', (e) => {
        const termo = e.target.value.toLowerCase();
        const linhas = document.querySelectorAll('#cardapio-table-body tr');
        
        linhas.forEach(linha => {
            const texto = linha.textContent.toLowerCase();
            linha.style.display = texto.includes(termo) ? '' : 'none';
        });
    });
    
    // Busca em usuários
    document.getElementById('search-usuarios')?.addEventListener('input', (e) => {
        const termo = e.target.value.toLowerCase();
        const linhas = document.querySelectorAll('#usuarios-table-body tr');
        
        linhas.forEach(linha => {
            const texto = linha.textContent.toLowerCase();
            linha.style.display = texto.includes(termo) ? '' : 'none';
        });
    });
}

// ===== FUNÇÕES AUXILIARES =====
function mostrarNotificacao(mensagem, tipo = 'info') {
    // Usando alert por enquanto para simplificar
    alert(mensagem);
}

// ===== ATUALIZAÇÃO PERIÓDICA =====
setInterval(() => {
    if (document.querySelector('.tab-btn.ativo')?.dataset.tab === 'dashboard') {
        carregarStats();
    }
}, 30000);
