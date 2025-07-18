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

// Indexler
deviceTokenSchema.index({ userId: 1 });
deviceTokenSchema.index({ fcmToken: 1 }, { unique: true });
deviceTokenSchema.index({ isActive: 1 });
deviceTokenSchema.index({ platform: 1 });
deviceTokenSchema.index({ lastActiveAt: -1 });

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);