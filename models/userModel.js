// models/userModel.js - GÜNCELLENMİŞ VERSİYON - İlan Hakkı Uyumlu

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String, required: true },
  profileImage: { 
    type: String, 
    default: 'image.jpg',
    get: (value) => value === 'image.jpg' ? '/assets/default-profile.jpg' : `/uploads/${value}`
  },
  
  // Profil alanları
  bio: { 
    type: String, 
    default: '',
    maxlength: 300 // 300 karakter sınırı
  },
  profileLinks: [{ // Tek link yerine 5 link dizisi
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
  
  // İlan hakkı ile ilgili virtual alanlar (ayrı koleksiyonda tutuluyor)
  // Bu alanlar gerçek değil, sadece referans için - gerçek veriler ListingRights modeline taşındı
  
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
  // Mağaza ile ilgili ayarlar (opsiyonel)
  storeSettings: {
    // Kullanıcının mağaza tercihlerini saklamak için
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

// Validation: Maksimum 5 link
userSchema.pre('save', function(next) {
  if (this.profileLinks && this.profileLinks.length > 5) {
    const error = new Error('Maksimum 5 link ekleyebilirsiniz');
    error.name = 'ValidationError';
    return next(error);
  }
  next();
});

// Virtual field: İlan hakkı bilgilerini almak için
userSchema.virtual('listingRights', {
  ref: 'ListingRights',
  localField: '_id',
  foreignField: 'userId',
  justOne: true
});

// Virtual field: Kullanıcının aktif ilanları
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
// Virtual field: Tam isim
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Virtual field: Profil tamamlanma oranı
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
  if (this.storeSettings && Object.keys(this.storeSettings).length > 0) completeness += 1;
  
  return Math.round((completeness / totalFields) * 100);
});

// Index'ler
userSchema.index({ username: 1 });
userSchema.index({ email: 1 });
userSchema.index({ firstName: 1, lastName: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ isActive: 1 });

// Instance method: İlan hakkı kontrolü (ayrı sorgulama gerektirir)
userSchema.methods.checkListingRights = async function() {
  const ListingRights = mongoose.model('ListingRights');
  return await ListingRights.findOne({ userId: this._id });
};

// Instance method: Kullanıcı istatistikleri
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

// Static method: İlan hakkı olan kullanıcıları bulma
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