// ===== CONFIGURAÇÃO DO SOCKET =====
// Pega a URL atual do site automaticamente
const serverUrl = window.location.origin;

console.log('🔌 Conectando ao servidor:', serverUrl);

// Conectar ao servidor Socket.IO
const socket = io(serverUrl, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 20000
});

// ===== EVENTOS DE CONEXÃO =====
socket.on('connect', () => {
  console.log('✅ Conectado ao servidor! Socket ID:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('❌ Erro de conexão:', error);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Desconectado do servidor. Motivo:', reason);
});

socket.on('reconnect', (attemptNumber) => {
  console.log('🔄 Reconectado após', attemptNumber, 'tentativas');
});

// ===== EVENTOS DE PEDIDO =====
// Novo pedido para cozinha
socket.on('pedido-para-cozinha', (pedido) => {
  console.log('📦 Novo pedido para cozinha:', pedido);
  // Dispara evento personalizado para a cozinha ouvir
  document.dispatchEvent(new CustomEvent('novoPedidoCozinha', { 
    detail: pedido 
  }));
});

// Pedido confirmado (para o garçom)
socket.on('pedido-confirmado', (data) => {
  console.log('✅ Pedido confirmado:', data);
  document.dispatchEvent(new CustomEvent('pedidoConfirmado', { 
    detail: data 
  }));
});

// Pedido em preparo
socket.on('pedido-em-preparo', (pedidoId) => {
  console.log('🔨 Pedido em preparo:', pedidoId);
  document.dispatchEvent(new CustomEvent('pedidoEmPreparo', { 
    detail: pedidoId 
  }));
});

// Pedido pronto para entrega
socket.on('pedido-para-entrega', (pedido) => {
  console.log('🍽️ Pedido pronto para entrega:', pedido);
  document.dispatchEvent(new CustomEvent('pedidoPronto', { 
    detail: pedido 
  }));
});

// Pedido finalizado (entregue)
socket.on('pedido-finalizado', (pedidoId) => {
  console.log('✅ Pedido finalizado:', pedidoId);
  document.dispatchEvent(new CustomEvent('pedidoFinalizado', { 
    detail: pedidoId 
  }));
});

// Carregar pedidos existentes (quando a cozinha entra)
socket.on('carregar-pedidos', (dados) => {
  console.log('📋 Carregando pedidos existentes:', dados);
  document.dispatchEvent(new CustomEvent('carregarPedidos', { 
    detail: dados 
  }));
});

// ===== FUNÇÕES AUXILIARES =====
// Verificar status da conexão
window.verificarSocket = () => {
  console.log('📊 Status da conexão:');
  console.log('Conectado:', socket.connected);
  console.log('ID:', socket.id);
  return socket.connected;
};

// Exportar socket para uso global
window.socket = socket;

console.log('⚡ Socket-client carregado com sucesso!');
