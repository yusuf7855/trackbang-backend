// models/StoreListing.js - Index duplicate sorunu düzeltilmiş

const mongoose = require('mongoose');

const storeListingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
    // unique: true kaldırıldı - bir kullanıcının birden çok ilanı olabilir
    // Manuel index aşağıda tanımlanacak
  },
  
  listingNumber: {
    type: String,
    unique: true,  // Bu otomatik index oluşturur
    required: true
    // Manuel index tanımlamaya gerek yok
  },
  
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  
  category: {
    type: String,
    required: true,
    enum: [
      'Elektronik',
      'Müzik Enstrümanları', 
      'DJ Ekipmanları',
      'Ses Sistemleri',
      'Yazılım',
      'Aksesuarlar',
      'Diğer'
    ]
  },
  
  price: {
    type: Number,
    required: true,
    min: 0
  },
  
  currency: {
    type: String,
    default: 'TRY',
    enum: ['TRY', 'USD', 'EUR']
  },
  
  condition: {
    type: String,
    required: true,
    enum: ['Yeni', 'Az Kullanılmış', 'İyi Durumda', 'Orta Durumda', 'Tamir Gerekir']
  },
  
  location: {
    city: {
      type: String,
      required: true
    },
    district: {
      type: String,
      required: false
    },
    address: {
      type: String,
      required: false
    }
  },
  
  contact: {
    phone: {
      type: String,
      required: false
    },
    email: {
      type: String,
      required: false
    },
    whatsapp: {
      type: String,
      required: false
    },
    preferredContact: {
      type: String,
      enum: ['phone', 'email', 'whatsapp', 'message'],
      default: 'message'
    }
  },
  
  images: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    uploadDate: {
      type: Date,
      default: Date.now
    },
    size: {
      type: Number
    }
  }],
  
  specifications: {
    brand: String,
    model: String,
    year: Number,
    warranty: {
      exists: { type: Boolean, default: false },
      duration: String,
      type: String
    }
  },
  
  status: {
    type: String,
    enum: ['active', 'sold', 'reserved', 'expired', 'paused'],
    default: 'active'
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  featured: {
    type: Boolean,
    default: false
  },
  
  views: {
    type: Number,
    default: 0
  },
  
  contactCount: {
    type: Number,
    default: 0
  },
  
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 gün sonra
    }
  },
  
  tags: [String],
  
  isPromoted: {
    type: Boolean,
    default: false
  },
  
  promotionExpiry: {
    type: Date
  }
  
}, {
  timestamps: true
});

// ✅ SADECE MANUEL INDEX'LER - duplicate'leri önlemek için
// listingNumber zaten unique: true ile otomatik index'e sahip
// userId için manuel index (unique değil - bir user'ın birden çok ilanı olabilir)

// Kullanıcı ilanları için
storeListingSchema.index({ userId: 1, status: 1 });

// Aktif ilanlar için
storeListingSchema.index({ isActive: 1, status: 1 });

// Kategori bazlı arama için
storeListingSchema.index({ category: 1, isActive: 1 });

// Fiyat aralığı sorguları için
storeListingSchema.index({ price: 1, currency: 1 });

// Lokasyon bazlı arama için
storeListingSchema.index({ 'location.city': 1 });

// Son eklenen ilanlar için
storeListingSchema.index({ createdAt: -1 });

// Öne çıkan ilanlar için
storeListingSchema.index({ featured: 1, isActive: 1 });

// Süre kontrolü için
storeListingSchema.index({ expiresAt: 1, isActive: 1 });

// Arama için text index
storeListingSchema.index({ 
  title: 'text', 
  description: 'text',
  'specifications.brand': 'text',
  'specifications.model': 'text'
});

// Virtual fields
storeListingSchema.virtual('isExpired').get(function() {
  return new Date() > this.expiresAt;
});

storeListingSchema.virtual('daysRemaining').get(function() {
  const now = new Date();
  const expiry = new Date(this.expiresAt);
  const diffTime = expiry - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
});

storeListingSchema.virtual('mainImage').get(function() {
  return this.images && this.images.length > 0 ? this.images[0] : null;
});

// Instance methods
storeListingSchema.methods.incrementView = function() {
  this.views += 1;
  return this.save();
};

storeListingSchema.methods.incrementContact = function() {
  this.contactCount += 1;
  return this.save();
};

storeListingSchema.methods.getImageUrls = function(baseUrl = '') {
  return this.images.map(img => `${baseUrl}/uploads/store-listings/${img.filename}`);
};

// Static methods
storeListingSchema.statics.findActiveListings = function(filter = {}) {
  return this.find({
    ...filter,
    isActive: true,
    status: 'active',
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });
};

storeListingSchema.statics.findByCategory = function(category) {
  return this.findActiveListings({ category });
};

storeListingSchema.statics.findByUser = function(userId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

// Middleware
storeListingSchema.pre('save', function(next) {
  if (this.isNew) {
    // Yeni ilan için otomatik listingNumber oluştur
    if (!this.listingNumber) {
      this.listingNumber = `LST${Date.now()}${Math.floor(Math.random() * 1000)}`;
    }
  }
  next();
});

module.exports = mongoose.model('StoreListing', storeListingSchema);