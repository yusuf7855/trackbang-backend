// models/Sample.js
const mongoose = require('mongoose');

const sampleSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    trim: true
  },
  genre: { 
    type: String, 
    required: true,
    enum: ['Afro House', 'İndie Dance', 'Melodic House', 'Organic House', 'Down Tempo']
  },
  price: { 
    type: Number, 
    required: true,
    min: 0
  },
  paymentStatus: { 
    type: String, 
    enum: ['paid', 'free', 'pending'], 
    default: function() {
      return this.price === 0 ? 'free' : 'paid';
    }
  },
  
  // Dosya bilgileri
  imageUrl: { 
    type: String, 
    required: true 
  },
  imagePath: { 
    type: String, 
    required: true 
  },
  
  demoUrl: { 
    type: String, 
    required: true 
  },
  demoPath: { 
    type: String, 
    required: true 
  },
  demoFileName: { 
    type: String, 
    required: true 
  },
  
  mainContentUrl: { 
    type: String, 
    required: true 
  },
  mainContentPath: { 
    type: String, 
    required: true 
  },
  mainContentFileName: { 
    type: String, 
    required: true 
  },
  
  // Eski alanlar (backward compatibility için)
  name: { 
    type: String,
    get: function() {
      return this.title;
    }
  },
  category: { 
    type: String,
    get: function() {
      return this.genre;
    }
  },
  fileName: { 
    type: String,
    get: function() {
      return this.demoFileName;
    }
  },
  filePath: { 
    type: String,
    get: function() {
      return this.demoPath;
    }
  },
  
  // Metadata
  fileSize: {
    demo: { type: Number },
    mainContent: { type: Number }
  },
  duration: { type: Number }, // Demo dosyasının süresi (saniye)
  downloads: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

// Index'ler
sampleSchema.index({ genre: 1 });
sampleSchema.index({ price: 1 });
sampleSchema.index({ createdAt: -1 });
sampleSchema.index({ title: 'text' });

// Virtual fields
sampleSchema.virtual('isNew').get(function() {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  return this.createdAt > threeDaysAgo;
});

sampleSchema.virtual('isFree').get(function() {
  return this.price === 0;
});

// Pre-save middleware
sampleSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // PaymentStatus'u price'a göre otomatik ayarla
  if (this.price === 0) {
    this.paymentStatus = 'free';
  } else if (this.paymentStatus === 'free' && this.price > 0) {
    this.paymentStatus = 'paid';
  }
  
  next();
});

// Static methods
sampleSchema.statics.getByGenre = function(genre) {
  return this.find({ genre: genre }).sort({ createdAt: -1 });
};

sampleSchema.statics.getFreesamples = function() {
  return this.find({ price: 0 }).sort({ createdAt: -1 });
};

sampleSchema.statics.getPaidSamples = function() {
  return this.find({ price: { $gt: 0 } }).sort({ createdAt: -1 });
};

sampleSchema.statics.searchSamples = function(query) {
  return this.find({
    $or: [
      { title: { $regex: query, $options: 'i' } },
      { genre: { $regex: query, $options: 'i' } }
    ]
  }).sort({ createdAt: -1 });
};

// Instance methods
sampleSchema.methods.incrementDownloads = function() {
  this.downloads += 1;
  return this.save();
};

sampleSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

module.exports = mongoose.model('Sample', sampleSchema);