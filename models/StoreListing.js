// models/StoreListing.js
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
    maxlength: 200
  },
  category: {
    type: String,
    required: true,
    enum: [
      'sound_cards',
      'monitors', 
      'midi_keyboards',
      'recording_sets',
      'production_computers',
      'dj_equipment',
      'production_control_devices',
      'gaming_podcast_equipment',
      'microphones',
      'headphones',
      'studio_dj_accessories',
      'cables',
      'interfaces',
      'recording_devices',
      'pre_amplifiers_effects',
      'software'
    ]
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'EUR'
  },
  description: {
    type: String,
    required: true,
    maxlength: 2000
  },
  phoneNumber: {
    type: String,
    required: true
  },
  images: [{
    filename: {
      type: String,
      required: true
    },
    originalName: String,
    uploadDate: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['active', 'inactive', 'expired', 'sold'],
    default: 'active'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'unpaid', 'expired'],
    default: 'unpaid'
  },
  expiryDate: {
    type: Date,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  views: {
    type: Number,
    default: 0
  },
  contactCount: {
    type: Number,
    default: 0
  },
  listingRights: {
    type: Number,
    default: 0 // Kullanıcının ilan hakkı sayısı
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Ilan numarası otomatik oluşturma
storeListingSchema.pre('save', async function(next) {
  if (!this.listingNumber) {
    const count = await this.constructor.countDocuments();
    this.listingNumber = `SL${(count + 1).toString().padStart(6, '0')}`;
  }
  
  // Ödeme yapılmışsa aktivasyon tarihi güncelle
  if (this.paymentStatus === 'paid' && this.status === 'inactive') {
    this.status = 'active';
    this.isActive = true;
    this.expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 gün
  }
  
  // Süre dolmuş mu kontrol et
  if (this.expiryDate < new Date() && this.status === 'active') {
    this.status = 'expired';
    this.isActive = false;
  }
  
  next();
});

// Virtual - Kategori display name
storeListingSchema.virtual('categoryDisplayName').get(function() {
  const categoryNames = {
    'sound_cards': 'Ses Kartları',
    'monitors': 'Monitörler',
    'midi_keyboards': 'MIDI Klavyeler',
    'recording_sets': 'Kayıt Setleri',
    'production_computers': 'Prodüksiyon Bilgisayarları',
    'dj_equipment': 'DJ Ekipmanları',
    'production_control_devices': 'Prodüksiyon Kontrol Cihazları',
    'gaming_podcast_equipment': 'Gaming ve Podcast Ekipmanları',
    'microphones': 'Mikrofonlar',
    'headphones': 'Kulaklıklar',
    'studio_dj_accessories': 'Studio / DJ Aksesuarları',
    'cables': 'Kablolar',
    'interfaces': 'Arabirimler',
    'recording_devices': 'Kayıt Cihazları',
    'pre_amplifiers_effects': 'Pre-Amifler / Efektler',
    'software': 'Yazılımlar'
  };
  return categoryNames[this.category] || this.category;
});

// Virtual - Kalan gün sayısı
storeListingSchema.virtual('remainingDays').get(function() {
  const now = new Date();
  const expiry = new Date(this.expiryDate);
  const diffTime = expiry - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
});

// Static methods
storeListingSchema.statics.getByCategory = function(category) {
  return this.find({ 
    category: category, 
    status: 'active',
    isActive: true 
  }).sort({ createdAt: -1 });
};

storeListingSchema.statics.getActiveListings = function() {
  return this.find({ 
    status: 'active',
    isActive: true,
    expiryDate: { $gt: new Date() }
  }).sort({ createdAt: -1 });
};

storeListingSchema.statics.searchListings = function(query) {
  return this.find({
    $and: [
      { status: 'active' },
      { isActive: true },
      {
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { description: { $regex: query, $options: 'i' } },
          { listingNumber: { $regex: query, $options: 'i' } }
        ]
      }
    ]
  }).sort({ createdAt: -1 });
};

// Instance methods
storeListingSchema.methods.incrementViews = function() {
  this.views += 1;
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
  this.expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 gün
  return this.save();
};

// Index'ler
storeListingSchema.index({ listingNumber: 1 });
storeListingSchema.index({ userId: 1 });
storeListingSchema.index({ category: 1 });
storeListingSchema.index({ status: 1, isActive: 1 });
storeListingSchema.index({ createdAt: -1 });
storeListingSchema.index({ expiryDate: 1 });

// Text search index
storeListingSchema.index({
  title: 'text',
  description: 'text',
  listingNumber: 'text'
}, {
  name: 'listing_search_index',
  weights: {
    title: 3,
    listingNumber: 2,
    description: 1
  }
});

module.exports = mongoose.model('StoreListing', storeListingSchema);