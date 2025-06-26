
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
