// Use a URL do seu servidor no Render
const serverUrl = 'https://restaurante-sistema-0kyy.onrender.com';

// Conectar ao servidor Socket.IO
window.socket = io(serverUrl, {
  transports: ['websocket', 'polling'], // Tenta WebSocket primeiro
  reconnection: true, // Tenta reconectar se cair
  reconnectionAttempts: 10, // Quantas vezes tentar reconectar
  reconnectionDelay: 1000, // Delay entre tentativas (1 segundo)
  timeout: 20000 // Timeout de 20 segundos
});

// Eventos de conexão
socket.on('connect', () => {
  console.log('✅ Conectado ao servidor do Render');
  console.log('Socket ID:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('❌ Erro de conexão:', error);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Desconectado:', reason);
});

// Eventos de pedido
socket.on('pedido-para-cozinha', (pedido) => {
  console.log('📦 Novo pedido para cozinha:', pedido);
  document.dispatchEvent(new CustomEvent('novoPedidoCozinha', { detail: pedido }));
});

socket.on('pedido-confirmado', (data) => {
  console.log('✅ Pedido confirmado:', data);
});

socket.on('pedido-em-preparo', (pedidoId) => {
  console.log('🔨 Pedido em preparo:', pedidoId);
  document.dispatchEvent(new CustomEvent('pedidoEmPreparo', { detail: pedidoId }));
});

socket.on('pedido-para-entrega', (pedido) => {
  console.log('🍽️ Pedido pronto para entrega:', pedido);
  document.dispatchEvent(new CustomEvent('pedidoPronto', { detail: pedido }));
});

socket.on('pedido-finalizado', (pedidoId) => {
  console.log('✅ Pedido finalizado:', pedidoId);
  document.dispatchEvent(new CustomEvent('pedidoFinalizado', { detail: pedidoId }));
});

// Evento para carregar pedidos existentes
socket.on('carregar-pedidos', (dados) => {
  console.log('📋 Carregando pedidos existentes:', dados);
  document.dispatchEvent(new CustomEvent('carregarPedidos', { detail: dados }));
});
