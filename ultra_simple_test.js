const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Sadece basit endpoint'ler - hiç model kullanma
app.get('/health', (req, res) => {
  res.json({ success: true, message: 'Ultra simple test' });
});

app.get('/api/store/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Store test without models',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/auth/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Auth test without models'
  });
});

// Mock data endpoints
app.get('/api/store/listings', (req, res) => {
  res.json({
    success: true,
    listings: [
      { id: 1, title: 'Test Item', price: 100, category: 'Elektronik' }
    ]
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
});

console.log('🚀 Starting ultra simple server...');

const PORT = 5000;
const server = app.listen(PORT, '0.0.0.0');

server.on('listening', () => {
  console.log('✅ Ultra simple server started on port', PORT);
  console.log('📍 http://localhost:5000/health');
  console.log('📍 http://localhost:5000/api/store/test');
  console.log('📍 http://localhost:5000/api/store/listings');
});

server.on('error', (error) => {
  console.error('❌ Server error:', error.message);
});

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  process.exit(0);
});

module.exports = app;