// models/StoreListing.js - GÜNCELLENMİŞ VERSİYON - İl/İlçe ve Konum Desteği

const mongoose = require('mongoose');

const storeListingSchema = new mongoose.Schema({
  listingNumber: {
    type: String,
    unique: true,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true
  },
  category: {
    type: String,
    required: true,
  enum: [
      'ses-kartlari',
      'monitorler',
      'midi-klavyeler',
      'kayit-setleri',
      'produksiyon-bilgisayarlari',
      'dj-ekipmanlari',
      'produksiyon-kontrol-cihazlari',
      'gaming-podcast-ekipmanlari',
      'mikrofonlar',
      'kulakliklar',
      'studyo-dj-ekipmanlari',
      'kablolar',
      'arabirimler',
      'kayit-cihazlari',
      'pre-amfiler-efektler',
      'yazilimlar'
    ]
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'TL'
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000,
    trim: true
  },
  phoneNumber: {
    type: String,
    required: true,
    trim: true
  },
  // YENİ - Konum bilgileri
  location: {
    province: {
      type: String,
      required: true,
      trim: true
    },
    district: {
      type: String,
      required: true,
      trim: true
    },
    // Google Maps için koordinatlar (opsiyonel - gelecekte kullanılabilir)
    coordinates: {
      latitude: {
        type: Number,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180
      }
    },
    // Tam adres (opsiyonel)
    fullAddress: {
      type: String,
      trim: true
    }
  },
  images: [{
    filename: {
      type: String,
      required: true
    },
    originalName: String,
    size: Number,
    mimetype: String,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'expired', 'sold', 'pending'],
    default: 'active'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'unpaid', 'expired'],
    default: 'paid'
  },
  expiryDate: {
    type: Date,
    required: true,
    default: function() {
      return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  viewCount: {
    type: Number,
    default: 0
  },
  contactCount: {
    type: Number,
    default: 0
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Pre-save middleware
storeListingSchema.pre('save', function(next) {
  // Generate listing number if not exists
  if (!this.listingNumber) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    this.listingNumber = `IL${timestamp}${random}`;
  }
  
  // Update timestamps
  this.updatedAt = new Date();
  
  // Check if expired
  if (this.expiryDate < new Date()) {
    this.status = 'expired';
    this.isActive = false;
  }
  
  next();
});

// Virtual for remaining days
storeListingSchema.virtual('remainingDays').get(function() {
  if (!this.expiryDate) return 0;
  const diffTime = this.expiryDate - new Date();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
});

// Virtual for image URLs
storeListingSchema.virtual('imageUrls').get(function() {
  return this.images.map(img => `/uploads/store-listings/${img.filename}`);
});

// Virtual for location display
storeListingSchema.virtual('locationDisplay').get(function() {
  if (this.location && this.location.province && this.location.district) {
    return `${this.location.district}, ${this.location.province}`;
  }
  return '';
});

// Static methods - YENİ konum filtresi eklendi
storeListingSchema.statics.getActiveListings = function(options = {}) {
  const query = {
    status: 'active',
    isActive: true,
    expiryDate: { $gt: new Date() }
  };
  
  if (options.category && options.category !== 'Tümü') {
    query.category = options.category;
  }
  
  if (options.province) {
    query['location.province'] = options.province;
  }
  
  if (options.district) {
    query['location.district'] = options.district;
  }
  
  if (options.priceMin || options.priceMax) {
    query.price = {};
    if (options.priceMin) query.price.$gte = options.priceMin;
    if (options.priceMax) query.price.$lte = options.priceMax;
  }
  
  let queryBuilder = this.find(query)
    .populate('userId', 'username firstName lastName profileImage');
  
  // Sorting
  switch (options.sort) {
    case 'price_asc':
      queryBuilder = queryBuilder.sort({ price: 1 });
      break;
    case 'price_desc':
      queryBuilder = queryBuilder.sort({ price: -1 });
      break;
    case 'date_asc':
      queryBuilder = queryBuilder.sort({ createdAt: 1 });
      break;
    default:
      queryBuilder = queryBuilder.sort({ createdAt: -1 });
  }
  
  return queryBuilder;
};

storeListingSchema.statics.searchListings = function(searchQuery, options = {}) {
  const query = {
    $and: [
      { status: 'active' },
      { isActive: true },
      { expiryDate: { $gt: new Date() } },
      {
        $or: [
          { title: { $regex: searchQuery, $options: 'i' } },
          { description: { $regex: searchQuery, $options: 'i' } },
          { listingNumber: { $regex: searchQuery, $options: 'i' } },
          { 'location.province': { $regex: searchQuery, $options: 'i' } },
          { 'location.district': { $regex: searchQuery, $options: 'i' } }
        ]
      }
    ]
  };
  
  if (options.category && options.category !== 'Tümü') {
    query.$and.push({ category: options.category });
  }
  
  return this.find(query)
    .populate('userId', 'username firstName lastName profileImage')
    .sort({ createdAt: -1 });
};

// Instance methods
storeListingSchema.methods.incrementViews = function() {
  this.viewCount += 1;
  return this.save();
};

storeListingSchema.methods.incrementContactCount = function() {
  this.contactCount += 1;
  return this.save();
};

storeListingSchema.methods.renewListing = function() {
  this.status = 'active';
  this.isActive = true;
  this.paymentStatus = 'paid';
  this.expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  return this.save();
};

storeListingSchema.methods.deactivate = function() {
  this.status = 'inactive';
  this.isActive = false;
  return this.save();
};

// Indexes
storeListingSchema.index({ listingNumber: 1 }, { unique: true });
storeListingSchema.index({ userId: 1 });
storeListingSchema.index({ category: 1 });
storeListingSchema.index({ status: 1, isActive: 1 });
storeListingSchema.index({ createdAt: -1 });
storeListingSchema.index({ expiryDate: 1 });
storeListingSchema.index({ price: 1 });
storeListingSchema.index({ 'location.province': 1 });
storeListingSchema.index({ 'location.district': 1 });

// Text search index - YENİ konum alanları eklendi
storeListingSchema.index({
  title: 'text',
  description: 'text',
  listingNumber: 'text',
  'location.province': 'text',
  'location.district': 'text'
}, {
  name: 'listing_search_index',
  weights: {
    title: 3,
    listingNumber: 2,
    'location.province': 2,
    'location.district': 2,
    description: 1
  }
});

module.exports = mongoose.model('StoreListing', storeListingSchema);