// 1. models/DeviceToken.js dosyasını oluşturun:
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

deviceTokenSchema.index({ userId: 1 });
deviceTokenSchema.index({ fcmToken: 1 }, { unique: true });
deviceTokenSchema.index({ isActive: 1 });
deviceTokenSchema.index({ platform: 1 });
deviceTokenSchema.index({ lastActiveAt: -1 });

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);

// ================================

// 2. models/Notification.js dosyasını oluşturun:
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  body: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  data: {
    type: Object,
    default: {}
  },
  targetUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  targetUserIds: [String],
  sentCount: {
    type: Number,
    default: 0
  },
  failedCount: {
    type: Number,
    default: 0
  },
  totalTargets: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'failed', 'partial'],
    default: 'pending'
  },
  sentAt: {
    type: Date,
    default: null
  },
  createdBy: {
    type: String,
    default: 'admin'
  },
  actions: [{
    action: String,
    title: String,
    url: String
  }],
  type: {
    type: String,
    enum: ['general', 'music', 'playlist', 'user', 'promotion'],
    default: 'general'
  },
  imageUrl: String,
  deepLink: String,
  category: {
    type: String,
    default: 'default'
  },
  sound: {
    type: String,
    default: 'default'
  },
  badge: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ status: 1 });
notificationSchema.index({ targetUsers: 1 });
notificationSchema.index({ type: 1 });

notificationSchema.virtual('successRate').get(function() {
  if (this.totalTargets === 0) return 0;
  return Math.round((this.sentCount / this.totalTargets) * 100);
});

notificationSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Notification', notificationSchema);

// ================================

// 3. controllers/notificationController.js dosyasını güncelleyin:
