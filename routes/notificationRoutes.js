// routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const authMiddleware = require('../middlewares/authMiddleware');

// ============ MOBIL UYGULAMA ROUTES (Auth Gerekli) ============

// FCM token kaydetme/güncelleme
router.post('/register-token', authMiddleware, notificationController.registerDeviceToken);

// Kullanıcının bildirimlerini getirme
router.get('/user', authMiddleware, notificationController.getUserNotifications);

// Bildirim ayarlarını güncelleme
router.put('/settings', authMiddleware, notificationController.updateNotificationSettings);

// Cihaz token'ını deaktive etme (kullanıcı çıkış yaptığında)
router.post('/deactivate-token', authMiddleware, notificationController.deactivateDeviceToken);

// ============ ADMIN PANEL ROUTES (Auth Gerekli veya IP bazlı güvenlik) ============

// Push bildirim gönderme (Admin)
router.post('/send', authMiddleware, notificationController.sendNotification);

// Bildirim geçmişini getirme (Admin)
router.get('/history', authMiddleware, notificationController.getNotificationHistory);

// İstatistikleri getirme (Admin)
router.get('/stats', authMiddleware, notificationController.getNotificationStats);

// ============ PUBLIC ROUTES (Test için) ============

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Notification service is running',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;