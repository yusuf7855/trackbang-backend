// models/ListingRights.js
const mongoose = require('mongoose');

const listingRightsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  totalRights: {
    type: Number,
    default: 0,
    min: 0
  },
  usedRights: {
    type: Number,
    default: 0,
    min: 0
  },
  availableRights: {
    type: Number,
    default: 0,
    min: 0
  },
  purchaseHistory: [{
    rightsAmount: {
      type: Number,
      required: true
    },
    pricePerRight: {
      type: Number,
      default: 4.00 // 4 Euro per listing right
    },
    totalPrice: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'EUR'
    },
    purchaseDate: {
      type: Date,
      default: Date.now
    },
    paymentMethod: {
      type: String,
      enum: ['free_credit', 'direct_purchase', 'admin_grant'],
      default: 'direct_purchase'
    },
    transactionId: String,
    status: {
      type: String,
      enum: ['completed', 'pending', 'failed'],
      default: 'completed'
    }
  }],
  usageHistory: [{
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StoreListing',
      required: true
    },
    usedAt: {
      type: Date,
      default: Date.now
    },
    action: {
      type: String,
      enum: ['create_listing', 'renew_listing'],
      required: true
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Pre-save middleware to calculate available rights
listingRightsSchema.pre('save', function(next) {
  this.availableRights = this.totalRights - this.usedRights;
  if (this.availableRights < 0) {
    this.availableRights = 0;
  }
  next();
});

// Static methods
listingRightsSchema.statics.getUserRights = async function(userId) {
  let userRights = await this.findOne({ userId });
  
  if (!userRights) {
    userRights = new this({
      userId,
      totalRights: 0,
      usedRights: 0,
      availableRights: 0
    });
    await userRights.save();
  }
  
  return userRights;
};

listingRightsSchema.statics.purchaseRights = async function(userId, rightsAmount, paymentMethod = 'direct_purchase') {
  const pricePerRight = 4.00;
  const totalPrice = rightsAmount * pricePerRight;
  
  let userRights = await this.getUserRights(userId);
  
  // Add purchase to history
  userRights.purchaseHistory.push({
    rightsAmount,
    pricePerRight,
    totalPrice,
    currency: 'EUR',
    paymentMethod,
    status: 'completed'
  });
  
  // Update totals
  userRights.totalRights += rightsAmount;
  
  await userRights.save();
  return userRights;
};

// Instance methods
listingRightsSchema.methods.useRight = function(listingId, action = 'create_listing') {
  if (this.availableRights <= 0) {
    throw new Error('Insufficient listing rights');
  }
  
  this.usedRights += 1;
  this.usageHistory.push({
    listingId,
    action
  });
  
  return this.save();
};

listingRightsSchema.methods.hasAvailableRights = function() {
  return this.availableRights > 0;
};

listingRightsSchema.methods.addFreeRights = function(amount, reason = 'admin_grant') {
  this.purchaseHistory.push({
    rightsAmount: amount,
    pricePerRight: 0,
    totalPrice: 0,
    currency: 'EUR',
    paymentMethod: 'free_credit',
    status: 'completed'
  });
  
  this.totalRights += amount;
  return this.save();
};

// Index'ler
listingRightsSchema.index({ userId: 1 }, { unique: true });
listingRightsSchema.index({ 'purchaseHistory.purchaseDate': -1 });
listingRightsSchema.index({ 'usageHistory.usedAt': -1 });

module.exports = mongoose.model('ListingRights', listingRightsSchema);