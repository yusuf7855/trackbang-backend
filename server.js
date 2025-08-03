// server.js - Güvenli server başlatma script'i

const { startServer } = require('./app');

// Sadece bu script çalıştırıldığında server'ı başlat
if (require.main === module) {
  console.log('🌟 Starting server from server.js...');
  startServer();
} else {
  console.log('⚠️ server.js imported as module, not starting server');
}