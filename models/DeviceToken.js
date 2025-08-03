// models/DeviceToken.js - Duplicate index sorunu tamamen çözülmüş versiyon

const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
    // ⚠️ index: true KALDIRILDI - Duplicate hatası önlendi
  },
  fcmToken: {
    type: String,
    required: true,
    unique: true  // ✅ Bu otomatik index oluşturur, başka tanımlama gerekmez
  },
  platform: {
    type: String,
    enum: ['ios', 'android'],
    required: true
  },
  deviceId: {
    type: String,
    required: true
  },
  deviceModel: {
    type: String,
    default: 'unknown'
  },
  osVersion: {
    type: String,
    default: 'unknown'
  },
  appVersion: {
    type: String,
    default: '1.0.0'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  },
  notificationSettings: {
    enabled: {
      type: Boolean,
      default: true
    },
    sound: {
      type: Boolean,
      default: true
    },
    vibration: {
      type: Boolean,
      default: true
    },
    badge: {
      type: Boolean,
      default: true
    },
    types: {
      general: { type: Boolean, default: true },
      music: { type: Boolean, default: true },
      playlist: { type: Boolean, default: true },
      user: { type: Boolean, default: true },
      promotion: { type: Boolean, default: true }
    }
  },
  invalidatedAt: {
    type: Date,
    default: null
  },
  invalidationReason: {
    type: String,
    enum: ['token_expired', 'app_uninstalled', 'user_disabled', 'other'],
    default: null
  }
}, {
  timestamps: true
});

// ============ MANUEL INDEX'LER - DUPLICATE ÖNLENMIŞ ============
// ⚠️ fcmToken zaten unique: true ile otomatik index'e sahip
// ⚠️ _id zaten otomatik index'e sahip

// Kullanıcı bazlı sorgular için - BU GEREKLI
deviceTokenSchema.index({ userId: 1 });

// Aktif cihazlar için
deviceTokenSchema.index({ isActive: 1 });

// Platform bazlı sorgular için
deviceTokenSchema.index({ platform: 1 });

// Son aktivite tarihi için (cleanup işlemleri)
deviceTokenSchema.index({ lastActiveAt: -1 });

// Compound index: userId + isActive (en çok kullanılan sorgu)
deviceTokenSchema.index({ userId: 1, isActive: 1 });

// Compound index: platform + isActive
deviceTokenSchema.index({ platform: 1, isActive: 1 });

// ============ INSTANCE METHODS ============
deviceTokenSchema.methods.markAsInvalid = function(reason = 'other') {
  this.isActive = false;
  this.invalidatedAt = new Date();
  this.invalidationReason = reason;
  return this.save();
};

deviceTokenSchema.methods.updateLastActive = function() {
  this.lastActiveAt = new Date();
  return this.save();
};

deviceTokenSchema.methods.updateNotificationSettings = function(settings) {
  this.notificationSettings = { ...this.notificationSettings, ...settings };
  return this.save();
};

// ============ STATIC METHODS ============
deviceTokenSchema.statics.findActiveByUser = function(userId) {
  return this.find({ 
    userId: userId, 
    isActive: true 
  }).sort({ lastActiveAt: -1 });
};

deviceTokenSchema.statics.findByPlatform = function(platform, activeOnly = true) {
  const query = { platform };
  if (activeOnly) query.isActive = true;
  
  return this.find(query).sort({ lastActiveAt: -1 });
};

deviceTokenSchema.statics.cleanupInactiveTokens = async function(daysBefore = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBefore);
  
  const result = await this.deleteMany({
    $or: [
      { isActive: false, invalidatedAt: { $lt: cutoffDate } },
      { lastActiveAt: { $lt: cutoffDate } }
    ]
  });
  
  console.log(`🧹 ${result.deletedCount} inactive device tokens cleaned up`);
  return result;
};

deviceTokenSchema.statics.invalidateToken = async function(fcmToken, reason = 'token_expired') {
  return this.findOneAndUpdate(
    { fcmToken },
    { 
      isActive: false, 
      invalidatedAt: new Date(), 
      invalidationReason: reason 
    },
    { new: true }
  );
};

// ============ PRE/POST HOOKS ============
// Token kaydetmeden önce eski token'ları temizle
deviceTokenSchema.pre('save', async function(next) {
  if (this.isNew && this.fcmToken) {
    // Aynı cihaz için eski token'ları deaktive et
    await this.constructor.updateMany(
      { 
        deviceId: this.deviceId, 
        fcmToken: { $ne: this.fcmToken },
        isActive: true 
      },
      { 
        isActive: false, 
        invalidatedAt: new Date(),
        invalidationReason: 'new_token_registered'
      }
    );
  }
  next();
});

// ============ VIRTUAL FIELDS ============
deviceTokenSchema.virtual('isExpired').get(function() {
  if (!this.invalidatedAt) return false;
  
  // 7 gün sonra expired sayalım
  const expireDate = new Date(this.invalidatedAt);
  expireDate.setDate(expireDate.getDate() + 7);
  
  return new Date() > expireDate;
});

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);