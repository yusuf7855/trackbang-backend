// controllers/paymentController.js
const Payment = require('../models/Payment');
const User = require('../models/userModel');
const { v4: uuidv4 } = require('uuid');

// Google Play In-App Purchase doğrulama
exports.verifyGooglePlayPurchase = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    const { purchaseToken, productId, orderId } = req.body;

    console.log('🔔 Google Play purchase verification:', {
      userId,
      productId,
      orderId
    });

    // Google Play Developer API ile doğrulama
    const { google } = require('googleapis');
    const androidpublisher = google.androidpublisher('v3');
    
    // Service account credentials gerekli
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
      scopes: ['https://www.googleapis.com/auth/androidpublisher']
    });

    const authClient = await auth.getClient();
    
    const result = await androidpublisher.purchases.subscriptions.get({
      auth: authClient,
      packageName: process.env.ANDROID_PACKAGE_NAME,
      subscriptionId: productId,
      token: purchaseToken
    });

    const purchase = result.data;
    
    // Satın alma durumu kontrolü
    if (purchase.paymentState === 1) { // Received
      // Payment kaydı oluştur
      const payment = new Payment({
        userId,
        amount: 10,
        currency: 'EUR',
        paymentMethod: 'google_play',
        status: 'completed',
        transactionId: orderId,
        googlePlayToken: purchaseToken,
        subscriptionType: 'monthly',
        endDate: new Date(parseInt(purchase.expiryTimeMillis)),
        isActive: true,
        receiptData: purchase
      });

      await payment.save();

      // User subscription güncelle
      const user = await User.findById(userId);
      user.subscription = {
        isActive: true,
        type: 'premium',
        startDate: new Date(),
        endDate: new Date(parseInt(purchase.expiryTimeMillis)),
        paymentMethod: 'google_play',
        lastPaymentId: payment._id
      };
      
      await user.save();

      res.json({
        success: true,
        message: 'Ödeme başarıyla doğrulandı!',
        subscription: {
          isActive: true,
          endDate: new Date(parseInt(purchase.expiryTimeMillis))
        }
      });

    } else {
      throw new Error('Payment not completed');
    }

  } catch (error) {
    console.error('❌ Payment verification error:', error);
    res.status(400).json({
      success: false,
      message: 'Ödeme doğrulanamadı',
      error: error.message
    });
  }
};

// Kullanıcının abonelik durumunu kontrol et
exports.getSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    
    const user = await User.findById(userId)
      .select('subscription')
      .populate('subscription.lastPaymentId');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    const isPremium = user.subscription.isActive && 
                     user.subscription.endDate && 
                     new Date() < user.subscription.endDate;

    res.json({
      success: true,
      subscription: {
        ...user.subscription.toObject(),
        isPremium,
        daysRemaining: isPremium ? 
          Math.ceil((user.subscription.endDate - new Date()) / (1000 * 60 * 60 * 24)) : 
          0
      }
    });

  } catch (error) {
    console.error('❌ Get subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Abonelik durumu alınamadı',
      error: error.message
    });
  }
};

// Ödeme geçmişi
exports.getPaymentHistory = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    const { page = 1, limit = 10 } = req.query;
    
    const payments = await Payment.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-receiptData'); // Hassas veriyi gizle

    const total = await Payment.countDocuments({ userId });

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
    console.error('❌ Get payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Ödeme geçmişi alınamadı',
      error: error.message
    });
  }
};