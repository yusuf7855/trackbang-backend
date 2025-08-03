// models/Payment.js - FINAL VERSİYON - Son düzeltme ile

const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
    // ⚠️ index: true KALDIRILDI - Duplicate hatası önlendi
  },
  
  transactionId: {
    type: String,
    required: true,
    unique: true  // ✅ Bu otomatik index oluşturur
  },
  
  googlePlayToken: {
    type: String
    // ⚠️ sparse: true KALDIRILDI - Bu schema'da değil, index'te olmalı
    // ⚠️ index: true ve unique: true KALDIRILDI
  },
  
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  
  currency: {
    type: String,
    default: 'TRY',
    enum: ['EUR', 'USD', 'TRY']
  },
  
  paymentMethod: {
    type: String,
    enum: ['google_play', 'app_store', 'stripe', 'paypal', 'test'],
    required: true
  },
  
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending'
  },
  
  productType: {
    type: String,
    enum: ['subscription', 'in_app_product', 'one_time', 'listing_rights'],
    required: true,
    default: 'one_time'
  },
  
  productId: {
    type: String,
    required: true
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
    required: function() {
      return this.productType === 'subscription' && !this.isPermanent;
    }
  },
  
  // Durumlar
  isActive: {
    type: Boolean,
    default: false
  },
  
  isPermanent: {
    type: Boolean,
    default: function() {
      return this.productType === 'one_time' || this.productType === 'in_app_product';
    }
  },
  
  // Google Play özel alanları
  googlePlayOrderId: String,
  googlePlayPackageName: String,
  googlePlayProductId: String,
  googlePlayPurchaseTime: Date,
  googlePlayPurchaseState: Number, // 0=purchased, 1=cancelled
  googlePlayConsumptionState: Number, // 0=yet to be consumed, 1=consumed
  
  // App Store özel alanları  
  appStoreTransactionId: String,
  appStoreOriginalTransactionId: String,
  appStoreReceipt: String,
  appStoreBundleId: String,
  
  // Listing rights için
  rightsQuantity: {
    type: Number,
    required: function() {
      return this.productType === 'listing_rights';
    },
    min: 0
  },
  
  // Verification ve error handling
  receiptData: Object,
  verificationData: Object,
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

// ============ MANUEL INDEX'LER - DUPLICATE TAMAMEN ÖNLENMİŞ ============
// ⚠️ transactionId zaten unique: true ile otomatik index'e sahip
// ⚠️ userId için index: true kaldırıldı, manuel compound index kullanıyoruz
// ⚠️ googlePlayToken için index: true kaldırıldı, manuel sparse index kullanıyoruz

// Kullanıcı ödemeleri için compound index
paymentSchema.index({ userId: 1, status: 1 });

// Ürün bazlı sorgular için
paymentSchema.index({ productId: 1 });
paymentSchema.index({ productType: 1 });

// Aktif abonelikler için
paymentSchema.index({ isActive: 1, endDate: 1 });

// Platform bazlı sorgular için
paymentSchema.index({ paymentMethod: 1, status: 1 });

// Google Play token için SPARSE index (null'lara izin verir)
paymentSchema.index({ googlePlayToken: 1 }, { sparse: true });

// App Store transaction için SPARSE index
paymentSchema.index({ appStoreTransactionId: 1 }, { sparse: true });

// Tarih bazlı sorgular için
paymentSchema.index({ createdAt: -1 });

// Test ödemeleri filtreleme için
paymentSchema.index({ isTestPurchase: 1 });

// ============ VIRTUAL FIELDS ============
paymentSchema.virtual('isExpired').get(function() {
  if (this.isPermanent) return false;
  if (!this.endDate) return false;
  return new Date() > this.endDate;
});

paymentSchema.virtual('daysRemaining').get(function() {
  if (this.isPermanent) return -1; // -1 = kalıcı
  if (!this.endDate) return 0;
  if (this.isExpired) return 0;
  return Math.ceil((this.endDate - new Date()) / (1000 * 60 * 60 * 24));
});

paymentSchema.virtual('formattedAmount').get(function() {
  return `${this.amount} ${this.currency}`;
});

// ============ INSTANCE METHODS ============
paymentSchema.methods.isValidPremium = function() {
  return this.isActive && this.status === 'completed' && (!this.isExpired || this.isPermanent);
};

paymentSchema.methods.activate = function() {
  this.isActive = true;
  this.status = 'completed';
  return this.save();
};

paymentSchema.methods.deactivate = function(reason = 'expired') {
  this.isActive = false;
  if (reason === 'expired') {
    // Status'u değiştirme, sadece deaktive et
  } else {
    this.status = reason;
  }
  return this.save();
};

paymentSchema.methods.addVerificationAttempt = function(errorMessage = null) {
  this.verificationAttempts += 1;
  this.lastVerificationAt = new Date();
  if (errorMessage) {
    this.errorMessage = errorMessage;
  }
  return this.save();
};

paymentSchema.methods.getDisplayInfo = function() {
  return {
    _id: this._id,
    amount: this.amount,
    currency: this.currency,
    productType: this.productType,
    productId: this.productId,
    subscriptionType: this.subscriptionType,
    isPermanent: this.isPermanent,
    isExpired: this.isExpired,
    daysRemaining: this.daysRemaining,
    isActive: this.isActive,
    status: this.status,
    startDate: this.startDate,
    endDate: this.endDate,
    createdAt: this.createdAt
  };
};

// ============ STATIC METHODS ============
paymentSchema.statics.findActiveByUser = function(userId) {
  return this.find({
    userId: userId,
    isActive: true,
    status: 'completed'
  }).sort({ createdAt: -1 });
};

paymentSchema.statics.findActivePremiumByUser = function(userId) {
  return this.findOne({
    userId: userId,
    productType: { $in: ['subscription', 'in_app_product', 'one_time'] },
    isActive: true,
    status: 'completed',
    $or: [
      { isPermanent: true },
      { endDate: { $gt: new Date() } }
    ]
  });
};

paymentSchema.statics.findByTransactionId = function(transactionId) {
  return this.findOne({ transactionId });
};

paymentSchema.statics.findByGooglePlayToken = function(token) {
  return this.findOne({ googlePlayToken: token });
};

paymentSchema.statics.getTotalRevenue = function(startDate = null, endDate = null) {
  const matchQuery = { status: 'completed' };
  
  if (startDate || endDate) {
    matchQuery.createdAt = {};
    if (startDate) matchQuery.createdAt.$gte = startDate;
    if (endDate) matchQuery.createdAt.$lte = endDate;
  }
  
  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$currency',
        totalAmount: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    }
  ]);
};

// ============ PRE/POST HOOKS ============
// Ödeme tamamlandığında kullanıcının subscription'ını güncelle
paymentSchema.post('save', async function(doc) {
  if (doc.isActive && doc.status === 'completed') {
    const User = mongoose.model('User');
    
    if (doc.productType === 'subscription' || doc.productType === 'in_app_product' || doc.productType === 'one_time') {
      await User.findByIdAndUpdate(doc.userId, {
        'subscription.isActive': true,
        'subscription.type': 'premium',
        'subscription.startDate': doc.startDate,
        'subscription.endDate': doc.endDate,
        'subscription.paymentMethod': doc.paymentMethod,
        'subscription.lastPaymentId': doc._id
      });
    }
    
    // Listing rights için ListingRights modelini güncelle
    if (doc.productType === 'listing_rights' && doc.rightsQuantity) {
      const ListingRights = mongoose.model('ListingRights');
      await ListingRights.findOneAndUpdate(
        { userId: doc.userId },
        { 
          $inc: { 
            availableRights: doc.rightsQuantity,
            totalRights: doc.rightsQuantity
          }
        },
        { upsert: true }
      );
    }
  }
});

// ============ JSON TRANSFORMATION ============
paymentSchema.methods.toJSON = function() {
  const paymentObject = this.toObject();
  
  // Hassas bilgileri kaldır
  delete paymentObject.receiptData;
  delete paymentObject.verificationData;
  delete paymentObject.errorMessage;
  delete paymentObject.googlePlayToken;
  delete paymentObject.appStoreReceipt;
  
  return paymentObject;
};

module.exports = mongoose.model('Payment', paymentSchema);