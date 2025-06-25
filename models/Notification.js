// models/Notification.js
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
  }], // Boş array = tüm kullanıcılar
  targetUserIds: [String], // String user ID'ler için
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
  // Action butonları için (bonus özellik)
  actions: [{
    action: String, // 'view_detail', 'close', 'open_url'
    title: String,
    url: String
  }],
  // Bildirim türü
  type: {
    type: String,
    enum: ['general', 'music', 'playlist', 'user', 'promotion'],
    default: 'general'
  },
  // Görsel URL (isteğe bağlı)
  imageUrl: String,
  // Deep link bilgisi
  deepLink: String,
  // Bildirim kategorisi (Android için)
  category: {
    type: String,
    default: 'default'
  },
  // Ses ayarları
  sound: {
    type: String,
    default: 'default'
  },
  // Badge sayısı (iOS için)
  badge: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Index'ler
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ status: 1 });
notificationSchema.index({ targetUsers: 1 });
notificationSchema.index({ type: 1 });

// Sanal alan - gönderim başarı oranı
notificationSchema.virtual('successRate').get(function() {
  if (this.totalTargets === 0) return 0;
  return Math.round((this.sentCount / this.totalTargets) * 100);
});

// JSON çıktısında sanal alanları dahil et
notificationSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Notification', notificationSchema);