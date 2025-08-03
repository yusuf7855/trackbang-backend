// routes/paymentRoutes.js - Güncellenmiş versiyon

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middlewares/authMiddleware');

// ============ GOOGLE PLAY PAYMENT ROUTES ============

// Google Play satın alma doğrulama (hem abonelik hem uygulama içi ürün)
router.post('/verify-google-play', authMiddleware, paymentController.verifyGooglePlayPurchase);

// Google Play abonelik durumu sorgulama
router.post('/verify-subscription', authMiddleware, paymentController.verifyGooglePlaySubscription);

// Google Play purchase token ile doğrulama
router.post('/verify-token', authMiddleware, paymentController.verifyPurchaseToken);

// ============ USER STATUS ROUTES ============

// Kullanıcının premium/abonelik durumu
router.get('/subscription-status', authMiddleware, paymentController.getSubscriptionStatus);

// Kullanıcının aktif ödemelerini listele
router.get('/active-payments', authMiddleware, paymentController.getActivePayments);

// Premium durumu kontrolü (hızlı endpoint)
router.get('/premium-check', authMiddleware, paymentController.quickPremiumCheck);

// ============ PAYMENT HISTORY ROUTES ============

// Ödeme geçmişi (sayfalama ile)
router.get('/history', authMiddleware, paymentController.getPaymentHistory);

// Belirli bir ödeme detayı
router.get('/payment/:paymentId', authMiddleware, paymentController.getPaymentDetails);

// ============ TEST & DEBUG ROUTES ============

// Test premium aktivasyonu (geliştirme için)
router.post('/test-premium', authMiddleware, paymentController.activateTestPremium);

// Test abonelik aktivasyonu
router.post('/test-subscription', authMiddleware, async (req, res) => {
  try {
    const User = require('../models/userModel');
    const Payment = require('../models/Payment');
    const { duration = '30d' } = req.body;

    console.log('🧪 Test abonelik aktivasyonu:', { userId: req.userId, duration });

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    let endDate;
    if (duration === '1y') {
      endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    } else {
      endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    // Test payment kaydı oluştur
    const testPayment = new Payment({
      userId: req.userId,
      amount: 180,
      currency: 'TRY',
      paymentMethod: 'test',
      status: 'completed',
      transactionId: `test_sub_${Date.now()}`,
      productType: 'subscription',
      productId: 'dj_app_monthly_10_euro',
      subscriptionType: 'monthly',
      startDate: new Date(),
      endDate: endDate,
      isActive: true,
      isPermanent: false,
      isTestPurchase: true
    });

    await testPayment.save();

    // User subscription güncelle
    user.subscription = {
      isActive: true,
      type: 'premium',
      startDate: new Date(),
      endDate: endDate,
      paymentMethod: 'test',
      lastPaymentId: testPayment._id
    };
    
    await user.save();
    
    console.log('✅ Test abonelik aktivasyonu başarılı:', {
      userId: req.userId,
      paymentId: testPayment._id,
      endDate
    });
    
    res.json({ 
      success: true, 
      message: `Test abonelik activated (${duration})`,
      subscription: user.subscription,
      payment: testPayment.getDisplayInfo()
    });
    
  } catch (error) {
    console.error('❌ Test abonelik activation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Debug - kullanıcının tüm ödemelerini listele
router.get('/debug/user-payments', authMiddleware, async (req, res) => {
  try {
    const Payment = require('../models/Payment');
    
    const payments = await Payment.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .select('-receiptData -googlePlayToken');
    
    const activePayments = await Payment.findActiveUserPayments(req.userId);
    
    res.json({
      success: true,
      totalPayments: payments.length,
      activePayments: activePayments.length,
      payments: payments.map(p => p.getDisplayInfo()),
      activePaymentDetails: activePayments.map(p => p.getDisplayInfo())
    });
    
  } catch (error) {
    console.error('❌ Debug payments error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Ödeme iptal etme (test için)
router.post('/cancel-payment/:paymentId', authMiddleware, async (req, res) => {
  try {
    const Payment = require('../models/Payment');
    
    const payment = await Payment.findOne({
      _id: req.params.paymentId,
      userId: req.userId
    });
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Ödeme bulunamadı'
      });
    }
    
    payment.status = 'cancelled';
    payment.isActive = false;
    await payment.save();
    
    console.log('✅ Payment cancelled:', req.params.paymentId);
    
    res.json({
      success: true,
      message: 'Ödeme iptal edildi',
      payment: payment.getDisplayInfo()
    });
    
  } catch (error) {
    console.error('❌ Cancel payment error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============ ADMIN ROUTES (opsiyonel) ============

// Admin - tüm ödemeleri listele
router.get('/admin/all-payments', authMiddleware, async (req, res) => {
  try {
    // Sadece admin kullanıcılar erişebilir (middleware eklenebilir)
    const Payment = require('../models/Payment');
    const { page = 1, limit = 20, status, productType } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (productType) filter.productType = productType;
    
    const payments = await Payment.find(filter)
      .populate('userId', 'username email firstName lastName')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-receiptData');
    
    const total = await Payment.countDocuments(filter);
    
    res.json({
      success: true,
      payments,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total
      }
    });
    
  } catch (error) {
    console.error('❌ Admin payments error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;