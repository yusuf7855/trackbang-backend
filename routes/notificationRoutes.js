// routes/notificationRoutes.js - Bu dosyayı güncelleyin:

const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middlewares/authMiddleware');

// Request logging için middleware
router.use((req, res, next) => {
  console.log(`🔔 Notification Route: ${req.method} ${req.originalUrl}`);
  next();
});

// ============ PUBLIC ROUTES (Test için) ============

// Health check
router.get('/health', (req, res) => {
  console.log('✅ Health check çalıştı');
  res.json({
    success: true,
    message: 'Notification service is running',
    timestamp: new Date().toISOString(),
    routes: [
      'GET /health',
      'POST /send', 
      'GET /history',
      'GET /stats',  // Düzeltildi: admin/ prefix kaldırıldı
      'GET /admin/stats'  // Her iki endpoint de mevcut
    ]
  });
});

// ============ ADMIN PANEL ROUTES ============

// Push bildirim gönderme (Admin)
router.post('/send', (req, res, next) => {
  console.log('📤 Send notification endpoint çağrıldı');
  next();
}, notificationController.sendNotification);

// Bildirim geçmişini getirme (Admin)  
router.get('/history', (req, res, next) => {
  console.log('📋 History endpoint çağrıldı');
  next();
}, notificationController.getNotificationHistory);

// İstatistikleri getirme (Admin) - İki farklı endpoint
router.get('/stats', (req, res, next) => {
  console.log('📊 Stats endpoint çağrıldı (kısa)');
  next();
}, notificationController.getNotificationStats);

router.get('/admin/stats', (req, res, next) => {
  console.log('📊 Admin stats endpoint çağrıldı (uzun)');
  next();
}, notificationController.getNotificationStats);

// ============ MOBIL UYGULAMA ROUTES ============

// FCM token kaydetme/güncelleme
router.post('/register-token', authMiddleware, notificationController.registerDeviceToken);

// Kullanıcının bildirimlerini getirme
router.get('/user', authMiddleware, notificationController.getUserNotifications);

// Bildirim ayarlarını güncelleme
router.put('/settings', authMiddleware, notificationController.updateNotificationSettings);

// Cihaz token'ını deaktive etme
router.post('/deactivate-token', authMiddleware, notificationController.deactivateDeviceToken);

module.exports = router;