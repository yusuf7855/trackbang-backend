// routes/messageRoutes.js
const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middlewares/authMiddleware');

// Request logging middleware
router.use((req, res, next) => {
  console.log(`💬 Message Route: ${req.method} ${req.originalUrl}`);
  console.log(`💬 User ID: ${req.headers.authorization ? 'Auth present' : 'No auth'}`);
  next();
});

// ============ MESSAGE CRUD OPERATIONS ============

// Mesaj gönderme
router.post('/send', authMiddleware, messageController.sendMessage);

// İki kullanıcı arasındaki konuşmayı getir
router.get('/conversation/:otherUserId', authMiddleware, messageController.getConversation);

// Kullanıcının tüm konuşmalarını getir
router.get('/conversations', authMiddleware, messageController.getConversations);

// ============ MESSAGE STATUS OPERATIONS ============

// Belirli mesajı okundu olarak işaretle
router.put('/read/:messageId', authMiddleware, messageController.markMessageAsRead);

// Konuşmadaki tüm mesajları okundu olarak işaretle
router.put('/conversation/:otherUserId/read', authMiddleware, messageController.markConversationAsRead);

// Okunmamış mesaj sayısını getir
router.get('/unread/count', authMiddleware, messageController.getUnreadCount);

// ============ MESSAGE MANAGEMENT ============

// Mesaj silme (soft delete)
router.delete('/:messageId', authMiddleware, messageController.deleteMessage);

// Mesaj düzenleme
router.put('/:messageId', authMiddleware, messageController.editMessage);

// ============ SEARCH OPERATIONS ============

// Mesaj arama
router.get('/search', authMiddleware, messageController.searchMessages);

// ============ BACKWARD COMPATIBILITY ============

// Eski route formatları (mobil uygulamanın eski versiyonları için)
router.get('/:otherUserId', authMiddleware, messageController.getConversation);

// ============ HEALTH CHECK ============

// Health check endpoint
router.get('/health', (req, res) => {
  console.log('✅ Message service health check');
  res.json({
    success: true,
    service: 'Messages',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    endpoints: [
      'POST /send - Mesaj gönder',
      'GET /conversation/:otherUserId - Konuşma getir',
      'GET /conversations - Tüm konuşmalar',
      'PUT /read/:messageId - Mesajı okundu işaretle',
      'PUT /conversation/:otherUserId/read - Konuşmayı okundu işaretle',
      'GET /unread/count - Okunmamış mesaj sayısı',
      'DELETE /:messageId - Mesaj sil',
      'PUT /:messageId - Mesaj düzenle',
      'GET /search - Mesaj ara'
    ]
  });
});

// ============ ERROR HANDLING ============

// 404 handler for message routes
router.use('*', (req, res) => {
  console.log(`❌ Message route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Message endpoint bulunamadı',
    availableEndpoints: [
      '/send',
      '/conversation/:otherUserId',
      '/conversations',
      '/read/:messageId',
      '/conversation/:otherUserId/read',
      '/unread/count',
      '/:messageId (DELETE/PUT)',
      '/search'
    ]
  });
});

module.exports = router;