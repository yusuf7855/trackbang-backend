// controllers/paymentController.js - Güncellenmiş versiyon

const Payment = require('../models/Payment');
const User = require('../models/userModel');
const { v4: uuidv4 } = require('uuid');

// ============ GOOGLE PLAY VERIFICATION ============

// Ana Google Play satın alma doğrulama (hem abonelik hem uygulama içi ürün)
exports.verifyGooglePlayPurchase = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    const { purchaseToken, productId, orderId, purchaseType } = req.body;

    console.log('🔔 Google Play purchase verification başlatılıyor:', {
      userId,
      productId,
      orderId,
      purchaseType
    });

    // Önceki aynı purchase token kontrolü
    const existingPayment = await Payment.findByGooglePlayToken(purchaseToken);
    if (existingPayment && existingPayment.status === 'completed') {
      console.log('⚠️ Bu purchase token zaten kullanıldı:', purchaseToken);
      return res.status(400).json({
        success: false,
        message: 'Bu satın alma zaten işlenmiş'
      });
    }

    // Google Play Developer API ile doğrulama
    const { google } = require('googleapis');
    const androidpublisher = google.androidpublisher('v3');
    
    // Service account credentials
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
      scopes: ['https://www.googleapis.com/auth/androidpublisher']
    });

    const authClient = await auth.getClient();
    let purchase;
    let productType;

    // Ürün türüne göre doğrulama yöntemi seç
    if (purchaseType === 'in_app_product' || productId === 'dj_app_premium_access') {
      console.log('🛒 Uygulama içi ürün doğrulaması...');
      productType = 'in_app_product';
      
      const result = await androidpublisher.purchases.products.get({
        auth: authClient,
        packageName: process.env.ANDROID_PACKAGE_NAME,
        productId: productId,
        token: purchaseToken
      });

      purchase = result.data;
      console.log('📦 Uygulama içi ürün satın alma data:', {
        purchaseState: purchase.purchaseState,
        consumptionState: purchase.consumptionState,
        purchaseTimeMillis: purchase.purchaseTimeMillis
      });

      // Satın alma durumu kontrolü (0 = Purchased, 1 = Canceled)
      if (purchase.purchaseState === 0) {
        await processInAppProductPurchase(userId, productId, orderId, purchaseToken, purchase);
      } else {
        throw new Error(`Uygulama içi ürün satın alma durumu geçersiz: ${purchase.purchaseState}`);
      }

    } else {
      console.log('📅 Abonelik doğrulaması...');
      productType = 'subscription';
      
      const result = await androidpublisher.purchases.subscriptions.get({
        auth: authClient,
        packageName: process.env.ANDROID_PACKAGE_NAME,
        subscriptionId: productId,
        token: purchaseToken
      });

      purchase = result.data;
      console.log('📅 Abonelik satın alma data:', {
        paymentState: purchase.paymentState,
        autoRenewing: purchase.autoRenewing,
        startTimeMillis: purchase.startTimeMillis,
        expiryTimeMillis: purchase.expiryTimeMillis
      });

      // Abonelik durumu kontrolü (1 = Received)
      if (purchase.paymentState === 1) {
        await processSubscriptionPurchase(userId, productId, orderId, purchaseToken, purchase);
      } else {
        throw new Error(`Abonelik ödeme durumu geçersiz: ${purchase.paymentState}`);
      }
    }

    res.json({
      success: true,
      message: 'Ödeme başarıyla doğrulandı ve işlendi!',
      productType: productType,
      productId: productId
    });

  } catch (error) {
    console.error('❌ Payment verification error:', error);
    
    let errorMessage = 'Ödeme doğrulanamadı';
    let statusCode = 400;

    if (error.message.includes('Invalid purchase token')) {
      errorMessage = 'Geçersiz satın alma bilgisi';
    } else if (error.message.includes('not found')) {
      errorMessage = 'Satın alma kaydı bulunamadı';
    } else if (error.message.includes('geçersiz')) {
      errorMessage = error.message;
    } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMessage = 'Google Play API bağlantı hatası';
      statusCode = 503;
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : errorMessage
    });
  }
};

// ============ PURCHASE PROCESSING FUNCTIONS ============

// Uygulama içi ürün satın alma işleme
async function processInAppProductPurchase(userId, productId, orderId, purchaseToken, purchaseData) {
  console.log('🛒 Uygulama içi ürün işleniyor...');

  // Payment kaydı oluştur
  const payment = new Payment({
    userId,
    amount: 180,
    currency: 'TRY',
    paymentMethod: 'google_play',
    status: 'completed',
    transactionId: orderId,
    googlePlayToken: purchaseToken,
    productType: 'in_app_product',
    productId: productId,
    subscriptionType: 'one_time',
    startDate: new Date(parseInt(purchaseData.purchaseTimeMillis)),
    endDate: new Date('2099-12-31'), // Kalıcı erişim
    isActive: true,
    isPermanent: true,
    googlePlayPurchaseState: purchaseData.purchaseState,
    googlePlayConsumptionState: purchaseData.consumptionState,
    receiptData: purchaseData
  });

  await payment.save();
  console.log('💾 Uygulama içi ürün payment kaydı oluşturuldu:', payment._id);

  // User'ı premium yap (kalıcı erişim)
  const user = await User.findById(userId);
  user.subscription = {
    isActive: true,
    type: 'premium',
    startDate: new Date(),
    endDate: new Date('2099-12-31'), // Kalıcı erişim
    paymentMethod: 'google_play',
    lastPaymentId: payment._id
  };
  
  await user.save();
  console.log('👤 User premium erişim verildi (kalıcı):', userId);

  return payment;
}

// Abonelik satın alma işleme
async function processSubscriptionPurchase(userId, productId, orderId, purchaseToken, purchaseData) {
  console.log('📅 Abonelik işleniyor...');

  // Payment kaydı oluştur
  const payment = new Payment({
    userId,
    amount: 180,
    currency: 'TRY',
    paymentMethod: 'google_play',
    status: 'completed',
    transactionId: orderId,
    googlePlayToken: purchaseToken,
    productType: 'subscription',
    productId: productId,
    subscriptionType: 'monthly',
    startDate: new Date(parseInt(purchaseData.startTimeMillis)),
    endDate: new Date(parseInt(purchaseData.expiryTimeMillis)),
    isActive: true,
    isPermanent: false,
    autoRenewStatus: purchaseData.autoRenewing,
    renewalDate: new Date(parseInt(purchaseData.expiryTimeMillis)),
    receiptData: purchaseData
  });

  await payment.save();
  console.log('💾 Abonelik payment kaydı oluşturuldu:', payment._id);

  // User subscription güncelle
  const user = await User.findById(userId);
  user.subscription = {
    isActive: true,
    type: 'premium',
    startDate: new Date(parseInt(purchaseData.startTimeMillis)),
    endDate: new Date(parseInt(purchaseData.expiryTimeMillis)),
    paymentMethod: 'google_play',
    lastPaymentId: payment._id
  };
  
  await user.save();
  console.log('👤 User abonelik verildi:', userId);

  return payment;
}

// ============ STATUS CHECK FUNCTIONS ============

// Kullanıcının premium/abonelik durumunu kontrol et
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

    // Aktif ödemeleri kontrol et
    const activePayments = await Payment.findActiveUserPayments(userId);
    
    // Premium durumu hesapla
    const hasPermanentAccess = activePayments.some(p => p.isPermanent);
    const hasActiveSubscription = activePayments.some(p => !p.isPermanent && !p.isExpired);
    const isPremium = hasPermanentAccess || hasActiveSubscription || 
                     (user.subscription.isActive && user.subscription.endDate && new Date() < user.subscription.endDate);

    // En son ödeme bilgisi
    const latestPayment = activePayments.length > 0 ? activePayments[0] : null;

    const subscription = {
      ...user.subscription.toObject(),
      isPremium,
      hasPermanentAccess,
      hasActiveSubscription,
      activePaymentsCount: activePayments.length,
      latestPayment: latestPayment ? latestPayment.getDisplayInfo() : null,
      daysRemaining: isPremium && !hasPermanentAccess ? 
        Math.ceil((user.subscription.endDate - new Date()) / (1000 * 60 * 60 * 24)) : 
        (hasPermanentAccess ? -1 : 0) // -1 = kalıcı erişim
    };

    console.log('👤 User subscription status checked:', {
      userId,
      isPremium,
      hasPermanentAccess,
      hasActiveSubscription,
      activePaymentsCount: activePayments.length
    });

    res.json({
      success: true,
      subscription
    });

  } catch (error) {
    console.error('❌ Get subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Premium durumu alınamadı',
      error: error.message
    });
  }
};

// Hızlı premium kontrolü
exports.quickPremiumCheck = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    
    const activePayments = await Payment.findActiveUserPayments(userId);
    const isPremium = activePayments.length > 0;
    const hasPermanentAccess = activePayments.some(p => p.isPermanent);

    res.json({
      success: true,
      isPremium,
      hasPermanentAccess,
      accessType: hasPermanentAccess ? 'permanent' : 'subscription'
    });

  } catch (error) {
    console.error('❌ Quick premium check error:', error);
    res.status(500).json({
      success: false,
      isPremium: false
    });
  }
};

// Kullanıcının aktif ödemelerini listele
exports.getActivePayments = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    
    const activePayments = await Payment.findActiveUserPayments(userId);
    
    res.json({
      success: true,
      count: activePayments.length,
      payments: activePayments.map(p => p.getDisplayInfo())
    });

  } catch (error) {
    console.error('❌ Get active payments error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ============ PAYMENT HISTORY ============

// Ödeme geçmişi
exports.getPaymentHistory = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    const { page = 1, limit = 10, status, productType } = req.query;
    
    const filter = { userId };
    if (status) filter.status = status;
    if (productType) filter.productType = productType;
    
    const payments = await Payment.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-receiptData -googlePlayToken'); // Hassas veriyi gizle

    const total = await Payment.countDocuments(filter);

    res.json({
      success: true,
      payments: payments.map(p => p.getDisplayInfo()),
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

// Belirli bir ödeme detayı
exports.getPaymentDetails = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    const { paymentId } = req.params;
    
    const payment = await Payment.findOne({
      _id: paymentId,
      userId: userId
    });
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Ödeme bulunamadı'
      });
    }
    
    res.json({
      success: true,
      payment: payment.getDisplayInfo()
    });

  } catch (error) {
    console.error('❌ Get payment details error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ============ TEST FUNCTIONS ============

// Test premium aktivasyonu
exports.activateTestPremium = async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    const { duration = 'permanent', productType = 'in_app_product' } = req.body;

    console.log('🧪 Test premium activation:', { userId, duration, productType });

    let endDate;
    let isPermanent = false;
    
    if (duration === 'permanent') {
      endDate = new Date('2099-12-31');
      isPermanent = true;
    } else if (duration === '1y') {
      endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    } else {
      endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    // Test payment kaydı oluştur
    const testPayment = new Payment({
      userId,
      amount: 180,
      currency: 'TRY',
      paymentMethod: 'test',
      status: 'completed',
      transactionId: `test_${productType}_${Date.now()}`,
      productType: productType,
      productId: productType === 'in_app_product' ? 'dj_app_premium_access' : 'dj_app_monthly_10_euro',
      subscriptionType: isPermanent ? 'one_time' : 'monthly',
      startDate: new Date(),
      endDate: endDate,
      isActive: true,
      isPermanent: isPermanent,
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
    
    console.log('✅ Test premium activated:', {
      userId,
      paymentId: testPayment._id,
      productType,
      isPermanent,
      endDate
    });
    
    res.json({ 
      success: true, 
      message: `Test premium activated (${duration}, ${productType})`,
      subscription: user.subscription,
      payment: testPayment.getDisplayInfo()
    });
    
  } catch (error) {
    console.error('❌ Test premium activation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

// ============ ADDITIONAL VERIFICATION FUNCTIONS ============

// Google Play abonelik durumu sorgulama
exports.verifyGooglePlaySubscription = async (req, res) => {
  try {
    const { subscriptionId, purchaseToken } = req.body;
    
    console.log('📅 Google Play abonelik durumu sorgulanıyor:', {
      subscriptionId,
      purchaseToken: purchaseToken ? 'present' : 'missing'
    });

    // Google Play Developer API
    const { google } = require('googleapis');
    const androidpublisher = google.androidpublisher('v3');
    
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
      scopes: ['https://www.googleapis.com/auth/androidpublisher']
    });

    const authClient = await auth.getClient();
    
    const result = await androidpublisher.purchases.subscriptions.get({
      auth: authClient,
      packageName: process.env.ANDROID_PACKAGE_NAME,
      subscriptionId: subscriptionId,
      token: purchaseToken
    });

    const subscription = result.data;
    
    const subscriptionInfo = {
      isActive: subscription.paymentState === 1,
      autoRenewing: subscription.autoRenewing,
      startTime: new Date(parseInt(subscription.startTimeMillis)),
      expiryTime: new Date(parseInt(subscription.expiryTimeMillis)),
      paymentState: subscription.paymentState,
      cancelReason: subscription.cancelReason,
      userCancellationTimeMillis: subscription.userCancellationTimeMillis
    };

    console.log('📅 Google Play abonelik bilgisi:', subscriptionInfo);

    res.json({
      success: true,
      subscription: subscriptionInfo
    });

  } catch (error) {
    console.error('❌ Google Play abonelik sorgu hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Abonelik durumu sorgulanamadı',
      error: error.message
    });
  }
};

// Purchase token ile doğrulama
exports.verifyPurchaseToken = async (req, res) => {
  try {
    const { purchaseToken } = req.body;
    
    console.log('🔍 Purchase token doğrulanıyor...');

    // Veritabanında bu token ile ödeme var mı kontrol et
    const existingPayment = await Payment.findByGooglePlayToken(purchaseToken);
    
    if (existingPayment) {
      console.log('✅ Purchase token bulundu:', {
        paymentId: existingPayment._id,
        status: existingPayment.status,
        isActive: existingPayment.isActive
      });

      res.json({
        success: true,
        exists: true,
        payment: existingPayment.getDisplayInfo()
      });
    } else {
      console.log('❌ Purchase token bulunamadı');
      
      res.json({
        success: true,
        exists: false,
        message: 'Bu purchase token ile ödeme kaydı bulunamadı'
      });
    }

  } catch (error) {
    console.error('❌ Purchase token verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ============ WEBHOOK HANDLERS (İleride kullanım için) ============

// Google Play webhook handler
exports.handleGooglePlayWebhook = async (req, res) => {
  try {
    console.log('🔔 Google Play webhook alındı:', req.body);
    
    // Webhook doğrulama ve işleme burada yapılacak
    // Real-time subscription updates için kullanılabilir
    
    res.status(200).json({ success: true });
    
  } catch (error) {
    console.error('❌ Google Play webhook error:', error);
    res.status(500).json({ success: false });
  }
};

module.exports = {
  verifyGooglePlayPurchase: exports.verifyGooglePlayPurchase,
  verifyGooglePlaySubscription: exports.verifyGooglePlaySubscription,
  verifyPurchaseToken: exports.verifyPurchaseToken,
  getSubscriptionStatus: exports.getSubscriptionStatus,
  quickPremiumCheck: exports.quickPremiumCheck,
  getActivePayments: exports.getActivePayments,
  getPaymentHistory: exports.getPaymentHistory,
  getPaymentDetails: exports.getPaymentDetails,
  activateTestPremium: exports.activateTestPremium,
  handleGooglePlayWebhook: exports.handleGooglePlayWebhook
};