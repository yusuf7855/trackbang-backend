// models/DeviceToken.js
const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fcmToken: {
    type: String,
    required: true,
    unique: true
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
  // Bildirim ayarları
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
    // Bildirim türlerine göre ayarlar
    types: {
      general: { type: Boolean, default: true },
      music: { type: Boolean, default: true },
      playlist: { type: Boolean, default: true },
      user: { type: Boolean, default: true },
      promotion: { type: Boolean, default: true }
    }
  },
  // Token'ın geçersiz olma bilgisi
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

// Index'ler
deviceTokenSchema.index({ userId: 1 });
deviceTokenSchema.index({ fcmToken: 1 }, { unique: true });
deviceTokenSchema.index({ isActive: 1 });
deviceTokenSchema.index({ platform: 1 });
deviceTokenSchema.index({ lastActiveAt: -1 });

// Her kullanıcı için cihaz sayısını sınırla (max 5 cihaz)
deviceTokenSchema.pre('save', async function(next) {
  if (this.isNew) {
    const deviceCount = await this.constructor.countDocuments({ 
      userId: this.userId, 
      isActive: true 
    });
    
    if (deviceCount >= 5) {
      // En eski cihazı deaktive et
      await this.constructor.findOneAndUpdate(
        { userId: this.userId, isActive: true },
        { isActive: false, invalidatedAt: new Date(), invalidationReason: 'device_limit' },
        { sort: { lastActiveAt: 1 } }
      );
    }
  }
  next();
});

// Statik methodlar
deviceTokenSchema.statics.getActiveTokensForUser = function(userId) {
  return this.find({ userId, isActive: true }).select('fcmToken platform notificationSettings');
};

deviceTokenSchema.statics.getActiveTokensForUsers = function(userIds) {
  return this.find({ 
    userId: { $in: userIds }, 
    isActive: true,
    'notificationSettings.enabled': true
  }).select('fcmToken platform userId notificationSettings');
};

deviceTokenSchema.statics.getAllActiveTokens = function() {
  return this.find({ 
    isActive: true,
    'notificationSettings.enabled': true
  }).select('fcmToken platform userId notificationSettings');
};

// Instance methodlar
deviceTokenSchema.methods.updateLastActive = function() {
  this.lastActiveAt = new Date();
  return this.save();
};

deviceTokenSchema.methods.invalidate = function(reason = 'other') {
  this.isActive = false;
  this.invalidatedAt = new Date();
  this.invalidationReason = reason;
  return this.save();
};

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);