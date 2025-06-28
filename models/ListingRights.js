// models/ListingRights.js - DÜZELTİLMİŞ VERSİYON

const mongoose = require('mongoose');

const listingRightsSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
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
      required: true,
      min: 1
    },
    pricePerRight: {
      type: Number,
      default: 4.00 // 4 Euro per listing right
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'EUR',
      enum: ['EUR', 'USD', 'TRY']
    },
    purchaseDate: {
      type: Date,
      default: Date.now
    },
    paymentMethod: {
      type: String,
      enum: ['free_credit', 'direct_purchase', 'admin_grant', 'credit_card', 'paypal'],
      default: 'direct_purchase'
    },
    transactionId: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['completed', 'pending', 'failed', 'refunded'],
      default: 'completed'
    },
    notes: {
      type: String,
      default: ''
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
      enum: ['create_listing', 'renew_listing', 'promote_listing'],
      required: true
    },
    notes: {
      type: String,
      default: ''
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
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better performance
listingRightsSchema.index({ userId: 1 });
listingRightsSchema.index({ 'purchaseHistory.purchaseDate': -1 });
listingRightsSchema.index({ 'usageHistory.usedAt': -1 });

// Virtual for calculating remaining rights
listingRightsSchema.virtual('remainingRights').get(function() {
  return Math.max(0, this.totalRights - this.usedRights);
});

// Pre-save middleware to auto-calculate available rights
listingRightsSchema.pre('save', function(next) {
  // Recalculate available rights
  this.availableRights = Math.max(0, this.totalRights - this.usedRights);
  
  // Update timestamp
  this.updatedAt = new Date();
  
  next();
});

// Pre-validate middleware
listingRightsSchema.pre('validate', function(next) {
  // Ensure usedRights doesn't exceed totalRights
  if (this.usedRights > this.totalRights) {
    return next(new Error('Used rights cannot exceed total rights'));
  }
  
  // Ensure availableRights is never negative
  if (this.availableRights < 0) {
    this.availableRights = 0;
  }
  
  next();
});

// Static methods
listingRightsSchema.statics.getUserRights = async function(userId) {
  try {
    let userRights = await this.findOne({ userId });
    
    if (!userRights) {
      // Create new user rights with 1 free credit
      userRights = new this({
        userId,
        totalRights: 1,
        usedRights: 0,
        availableRights: 1,
        purchaseHistory: [{
          rightsAmount: 1,
          pricePerRight: 0,
          totalPrice: 0,
          currency: 'EUR',
          paymentMethod: 'free_credit',
          status: 'completed',
          notes: 'Welcome bonus - free listing right'
        }]
      });
      await userRights.save();
    }
    
    return userRights;
  } catch (error) {
    throw new Error(`Error getting user rights: ${error.message}`);
  }
};

listingRightsSchema.statics.purchaseRights = async function(userId, rightsAmount, paymentMethod = 'direct_purchase', transactionId = null) {
  try {
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
      transactionId,
      status: 'completed',
      notes: `Purchased ${rightsAmount} listing right(s)`
    });
    
    // Update rights
    userRights.totalRights += rightsAmount;
    userRights.availableRights += rightsAmount;
    
    await userRights.save();
    
    return userRights;
  } catch (error) {
    throw new Error(`Error purchasing rights: ${error.message}`);
  }
};

listingRightsSchema.statics.useRight = async function(userId, listingId, action = 'create_listing', notes = '') {
  try {
    const userRights = await this.findOne({ userId });
    
    if (!userRights) {
      throw new Error('User rights not found');
    }
    
    if (userRights.availableRights <= 0) {
      throw new Error('No available rights to use');
    }
    
    // Add to usage history
    userRights.usageHistory.push({
      listingId,
      usedAt: new Date(),
      action,
      notes
    });
    
    // Update counters
    userRights.usedRights += 1;
    userRights.availableRights -= 1;
    
    await userRights.save();
    
    return userRights;
  } catch (error) {
    throw new Error(`Error using right: ${error.message}`);
  }
};

listingRightsSchema.statics.grantRights = async function(userId, rightsAmount, grantedBy = 'admin', notes = '') {
  try {
    let userRights = await this.getUserRights(userId);
    
    userRights.purchaseHistory.push({
      rightsAmount,
      pricePerRight: 0,
      totalPrice: 0,
      currency: 'EUR',
      paymentMethod: 'admin_grant',
      status: 'completed',
      notes: notes || `Granted ${rightsAmount} listing right(s) by ${grantedBy}`
    });
    
    userRights.totalRights += rightsAmount;
    userRights.availableRights += rightsAmount;
    
    await userRights.save();
    
    return userRights;
  } catch (error) {
    throw new Error(`Error granting rights: ${error.message}`);
  }
};

// Instance methods
listingRightsSchema.methods.hasAvailableRights = function() {
  return this.availableRights > 0;
};

listingRightsSchema.methods.canUseRight = function() {
  return this.availableRights > 0 && this.usedRights < this.totalRights;
};

listingRightsSchema.methods.getTotalSpent = function() {
  return this.purchaseHistory.reduce((total, purchase) => {
    if (purchase.status === 'completed' && purchase.paymentMethod !== 'free_credit' && purchase.paymentMethod !== 'admin_grant') {
      return total + purchase.totalPrice;
    }
    return total;
  }, 0);
};

listingRightsSchema.methods.getRecentPurchases = function(limit = 5) {
  return this.purchaseHistory
    .sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate))
    .slice(0, limit);
};

listingRightsSchema.methods.getRecentUsage = function(limit = 10) {
  return this.usageHistory
    .sort((a, b) => new Date(b.usedAt) - new Date(a.usedAt))
    .slice(0, limit);
};

// Error handling middleware
listingRightsSchema.post('save', function(error, doc, next) {
  if (error.name === 'MongoError' && error.code === 11000) {
    next(new Error('User rights record already exists'));
  } else {
    next(error);
  }
});

// Export the model
module.exports = mongoose.model('ListingRights', listingRightsSchema);