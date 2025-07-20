// routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middlewares/authMiddleware');

// Google Play satın alma doğrulama
router.post('/verify-google-play', authMiddleware, paymentController.verifyGooglePlayPurchase);

// Abonelik durumu
router.get('/subscription-status', authMiddleware, paymentController.getSubscriptionStatus);

// Ödeme geçmişi
router.get('/history', authMiddleware, paymentController.getPaymentHistory);

// Test endpoint (geliştirme için)
router.post('/test-premium', authMiddleware, async (req, res) => {
  try {
    const User = require('../models/userModel');
    const user = await User.findById(req.userId);
    
    user.subscription = {
      isActive: true,
      type: 'premium',
      startDate: new Date(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 gün
      paymentMethod: 'test'
    };
    
    await user.save();
    
    res.json({ success: true, message: 'Test premium activated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;