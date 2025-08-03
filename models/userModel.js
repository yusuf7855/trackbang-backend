// models/userModel.js - Duplicate index sorunu çözülmüş versiyon

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { 
    type: String, 
    required: true, 
    unique: true  // ✅ Bu otomatik index oluşturur
  },
  email: { 
    type: String, 
    required: true, 
    unique: true  // ✅ Bu otomatik index oluşturur
  },
  password: { type: String, required: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  
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
  
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
  resetToken: String,
  resetTokenExpire: Date,
  
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
  
  storeSettings: {
    notifications: {
      newListingComments: { type: Boolean, default: true },
      listingExpiration: { type: Boolean, default: true },
      newFollower: { type: Boolean, default: true },
      directMessage: { type: Boolean, default: true }
    },
    privacy: {
      showEmail: { type: Boolean, default: false },
      showPhone: { type: Boolean, default: false },
      allowMessages: { type: Boolean, default: true }
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true, getters: true },
  toObject: { virtuals: true, getters: true }
});

// ============ MANUEL INDEX'LER - SADECE GEREKLİ OLANLAR ============
// ⚠️ username ve email zaten unique: true ile otomatik index'e sahip
// ⚠️ _id zaten otomatik index'e sahip

// Arama için compound index
userSchema.index({ 
  firstName: 'text', 
  lastName: 'text', 
  username: 'text' 
}, {
  name: 'user_search_index',
  weights: { username: 3, firstName: 2, lastName: 2 }
});

// Aktif kullanıcılar için
userSchema.index({ isActive: 1 });

// Son login tarihi için (performans)
userSchema.index({ lastLoginAt: -1 });

// Subscription sorguları için
userSchema.index({ 'subscription.isActive': 1, 'subscription.type': 1 });

// ============ VIRTUAL FIELDS ============
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.virtual('followersCount').get(function() {
  return this.followers ? this.followers.length : 0;
});

userSchema.virtual('followingCount').get(function() {
  return this.following ? this.following.length : 0;
});

// ============ INSTANCE METHODS ============
userSchema.methods.getPublicProfile = function() {
  return {
    _id: this._id,
    username: this.username,
    firstName: this.firstName,
    lastName: this.lastName,
    fullName: this.fullName,
    profileImage: this.profileImage,
    bio: this.bio,
    profileLinks: this.profileLinks,
    events: this.events,
    followersCount: this.followersCount,
    followingCount: this.followingCount,
    isActive: this.isActive,
    createdAt: this.createdAt
  };
};

userSchema.methods.toProfileJSON = function() {
  const userObject = this.toObject();
  
  // Hassas bilgileri kaldır
  delete userObject.password;
  delete userObject.resetToken;
  delete userObject.resetTokenExpire;
  delete userObject.email; // Profilde email gösterme
  
  return userObject;
};

// ============ STATIC METHODS ============
userSchema.statics.findUsersWithRights = async function() {
  try {
    const ListingRights = mongoose.model('ListingRights');
    const usersWithRights = await ListingRights.find({ 
      availableRights: { $gt: 0 } 
    })
    .populate('userId', 'username email firstName lastName')
    .lean();
    
    return usersWithRights.map(rights => ({
      ...rights.userId,
      availableRights: rights.availableRights
    }));
  } catch (error) {
    console.error('Error finding users with rights:', error);
    return [];
  }
};

userSchema.statics.searchByName = async function(searchTerm) {
  if (!searchTerm || searchTerm.trim() === '') return [];
  
  return this.find({
    $text: { $search: searchTerm },
    isActive: true
  })
  .select('username firstName lastName profileImage bio')
  .limit(20)
  .lean();
};

// ============ PRE/POST HOOKS ============
// Şifre hash'leme middleware'i burada olacak (bcrypt ile)

// ============ JSON TRANSFORMATION ============
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  
  // Hassas bilgileri kaldır
  delete userObject.password;
  delete userObject.resetToken;
  delete userObject.resetTokenExpire;
  
  return userObject;
};

module.exports = mongoose.model('User', userSchema);