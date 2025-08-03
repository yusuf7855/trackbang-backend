// models/userModel.js - Index duplicatelerinden temizlenmiş versiyon

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true  // Bu yeterli, ayrıca index tanımlamaya gerek yok
  },
  email: { 
    type: String, 
    required: true, 
    unique: true  // Bu yeterli, ayrıca index tanımlamaya gerek yok
  },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  
  // Phone alan opsiyonel - düzeltilmiş
  phone: { 
    type: String, 
    required: false,
    default: '',
    validate: {
      validator: function(v) {
        if (!v || v.trim() === '') return true;
        return /^[0-9+\-\s()]{10,15}$/.test(v);
      },
      message: 'Geçerli bir telefon numarası girin'
    }
  },
  
  profileImage: { 
    type: String, 
    default: 'image.jpg',
    get: (value) => value === 'image.jpg' ? '/assets/default-profile.jpg' : `/uploads/${value}`
  },
  
  // Profil alanları
  bio: { 
    type: String, 
    default: '',
    maxlength: 300
  },
  profileLinks: [{
    title: { type: String, required: true, maxlength: 50 },
    url: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  events: [{
    date: { type: Date, required: true },
    time: { type: String, required: true },
    city: { type: String, required: true },
    venue: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
  }],
  additionalImages: [{
    filename: { type: String, required: true },
    uploadDate: { type: Date, default: Date.now }
  }],
  
  // Sosyal özellikler
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  // Şifre sıfırlama
  resetToken: String,
  resetTokenExpire: Date,
  
  // Hesap durumu
  isActive: { 
    type: Boolean, 
    default: true 
  },
  lastLoginAt: { 
    type: Date 
  },

  subscription: {
    isActive: { type: Boolean, default: false },
    type: { type: String, enum: ['free', 'premium'], default: 'free' },
    startDate: Date,
    endDate: Date,
    paymentMethod: String,
    lastPaymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }
  },
  
  // Mağaza ile ilgili ayarlar
  storeSettings: {
    notifications: {
      newListingComments: { type: Boolean, default: true },
      listingExpiry: { type: Boolean, default: true },
      purchaseConfirmations: { type: Boolean, default: true }
    },
    privacy: {
      showPhone: { type: Boolean, default: true },
      showEmail: { type: Boolean, default: false },
      allowDirectMessages: { type: Boolean, default: true }
    }
  }
}, { 
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

// ✅ SADECE MANUEL INDEX'LER - duplicate'leri önlemek için
// Otomatik unique index'ler zaten var, manuel eklemeye gerek yok

// Arama için compound index
userSchema.index({ firstName: 1, lastName: 1 });

// Tarih bazlı sorgular için
userSchema.index({ createdAt: -1 });

// Aktif kullanıcılar için
userSchema.index({ isActive: 1 });

// Validation: Maksimum 5 link
userSchema.pre('save', function(next) {
  if (this.profileLinks && this.profileLinks.length > 5) {
    const error = new Error('Maksimum 5 link ekleyebilirsiniz');
    error.name = 'ValidationError';
    return next(error);
  }
  next();
});

// Virtual fields
userSchema.virtual('listingRights', {
  ref: 'ListingRights',
  localField: '_id',
  foreignField: 'userId',
  justOne: true
});

userSchema.virtual('activeListings', {
  ref: 'StoreListing',
  localField: '_id',
  foreignField: 'userId',
  match: { status: 'active', isActive: true }
});

userSchema.virtual('isPremium').get(function() {
  return this.subscription.isActive && 
         this.subscription.endDate && 
         new Date() < this.subscription.endDate;
});

userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`.trim();
});

userSchema.virtual('profileCompleteness').get(function() {
  let completeness = 0;
  const totalFields = 10;
  
  // Zorunlu alanlar zaten var (40%)
  completeness += 4;
  
  // Opsiyonel alanlar
  if (this.bio && this.bio.trim().length > 0) completeness += 1;
  if (this.profileLinks && this.profileLinks.length > 0) completeness += 1;
  if (this.profileImage !== 'image.jpg') completeness += 1;
  if (this.events && this.events.length > 0) completeness += 1;
  if (this.additionalImages && this.additionalImages.length > 0) completeness += 1;
  if (this.phone && this.phone.trim().length > 0) completeness += 1;
  
  return Math.round((completeness / totalFields) * 100);
});

// Instance methods
userSchema.methods.checkListingRights = async function() {
  const ListingRights = mongoose.model('ListingRights');
  return await ListingRights.findOne({ userId: this._id });
};

userSchema.methods.getStats = async function() {
  const StoreListing = mongoose.model('StoreListing');
  const ListingRights = mongoose.model('ListingRights');
  
  const [activeListings, totalListings, rights] = await Promise.all([
    StoreListing.countDocuments({ userId: this._id, status: 'active', isActive: true }),
    StoreListing.countDocuments({ userId: this._id }),
    ListingRights.findOne({ userId: this._id })
  ]);
  
  return {
    activeListings,
    totalListings,
    availableRights: rights ? rights.availableRights : 0,
    totalRights: rights ? rights.totalRights : 0,
    usedRights: rights ? rights.usedRights : 0,
    followersCount: this.followers ? this.followers.length : 0,
    followingCount: this.following ? this.following.length : 0
  };
};

// Static methods
userSchema.statics.findUsersWithRights = async function() {
  const ListingRights = mongoose.model('ListingRights');
  const usersWithRights = await ListingRights.find({ availableRights: { $gt: 0 } })
    .populate('userId', 'username email firstName lastName')
    .lean();
  
  return usersWithRights.map(rights => ({
    ...rights.userId,
    availableRights: rights.availableRights
  }));
};

// JSON transformation - hassas bilgileri gizle
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.resetToken;
  delete userObject.resetTokenExpire;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);