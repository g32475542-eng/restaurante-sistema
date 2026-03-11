// Conectar ao servidor Socket.IO
const socket = io('https://restaurante-sistema-0kyy.onrender.com', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10
});

// Eventos de conexão
socket.on('connect', () => {
    console.log('✅ Conectado ao servidor');
});

socket.on('disconnect', () => {
    console.log('❌ Desconectado do servidor');
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
