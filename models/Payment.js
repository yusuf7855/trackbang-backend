// models/Payment.js - Güncellenmiş versiyon

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    default: 180 // 180 TL
  },
  currency: {
    type: String,
    default: 'TRY',
    enum: ['EUR', 'USD', 'TRY']
  },
  paymentMethod: {
    type: String,
    enum: ['google_play', 'stripe', 'paypal', 'test'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  googlePlayToken: String, // Google Play receipt token
  
  // ✅ YENİ: Ürün türü ve abonelik bilgileri
  productType: {
    type: String,
    enum: ['subscription', 'in_app_product', 'one_time'],
    required: true,
    default: 'one_time'
  },
  productId: {
    type: String,
    required: true // dj_app_premium_access veya dj_app_monthly_10_euro
  },
  subscriptionType: {
    type: String,
    default: 'one_time',
    enum: ['monthly', 'yearly', 'one_time']
  },
  
  // Tarih bilgileri
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  
  // Durumlar
  isActive: {
    type: Boolean,
    default: false
  },
  isPermanent: {
    type: Boolean,
    default: false // Tek seferlik ödeme için true
  },
  
  // Google Play bilgileri
  receiptData: Object, // Store receipt verification data
  googlePlayPurchaseState: Number, // 0=purchased, 1=cancelled
  googlePlayConsumptionState: Number, // 0=yet to be consumed, 1=consumed
  
  // Hata ve log bilgileri
  errorMessage: String,
  verificationAttempts: {
    type: Number,
    default: 0
  },
  lastVerificationAt: Date,
  
  // Abonelik özellikleri
  autoRenewStatus: {
    type: Boolean,
    default: false
  },
  renewalDate: Date,
  
  // Test ve geliştirme
  isTestPurchase: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// ✅ İndeksler - duplicate'leri önlemek için sadece gerekli olanlar
paymentSchema.index({ userId: 1, status: 1 });
paymentSchema.index({ productId: 1 });
paymentSchema.index({ productType: 1 });
paymentSchema.index({ isActive: 1, endDate: 1 });
// transactionId zaten unique: true ile otomatik index'e sahip
// googlePlayToken için manuel index (unique değil çünkü null olabilir)
paymentSchema.index({ googlePlayToken: 1 }, { sparse: true });

// ✅ Virtual fields
paymentSchema.virtual('isExpired').get(function() {
  if (this.isPermanent) return false;
  return new Date() > this.endDate;
});

paymentSchema.virtual('daysRemaining').get(function() {
  if (this.isPermanent) return -1; // -1 = kalıcı
  if (this.isExpired) return 0;
  return Math.ceil((this.endDate - new Date()) / (1000 * 60 * 60 * 24));
});

// ✅ Instance methods
paymentSchema.methods.isValidPremium = function() {
  return this.isActive && (!this.isExpired || this.isPermanent);
};

paymentSchema.methods.getDisplayInfo = function() {
  return {
    amount: this.amount,
    currency: this.currency,
    productType: this.productType,
    subscriptionType: this.subscriptionType,
    isPermanent: this.isPermanent,
    isExpired: this.isExpired,
    daysRemaining: this.daysRemaining,
    startDate: this.startDate,
    endDate: this.endDate
  };
};

// ✅ Static methods
paymentSchema.statics.findActiveUserPayments = function(userId) {
  return this.find({
    userId: userId,
    isActive: true,
    $or: [
      { isPermanent: true },
      { endDate: { $gt: new Date() } }
    ]
  }).sort({ createdAt: -1 });
};

paymentSchema.statics.findByGooglePlayToken = function(token) {
  return this.findOne({ googlePlayToken: token });
};

// ✅ Middleware - save öncesi validasyon
paymentSchema.pre('save', function(next) {
  // Tek seferlik ödeme ise kalıcı yap
  if (this.productType === 'one_time' || this.productType === 'in_app_product') {
    this.isPermanent = true;
    this.endDate = new Date('2099-12-31'); // Çok ileri bir tarih
  }
  
  // Test ürünleri kontrolü
  if (this.productId && this.productId.includes('test')) {
    this.isTestPurchase = true;
  }
  
  next();
});

// ✅ JSON transformation - hassas bilgileri gizle
paymentSchema.methods.toJSON = function() {
  const paymentObject = this.toObject();
  delete paymentObject.receiptData;
  delete paymentObject.googlePlayToken;
  delete paymentObject.errorMessage;
  return paymentObject;
};

module.exports = mongoose.model('Payment', paymentSchema);