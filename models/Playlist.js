const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  musics: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Music' 
  }],
  // Ana kategori
  mainCategory: {
    type: String,
    required: true,
    enum: ['afrohouse', 'indiedance', 'organichouse', 'downtempo', 'melodichouse'],
  },
  // Alt kategori/Katalog numarası (AH1, MH1, vb.)
  subCategory: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Arama için index ekleme
playlistSchema.index({
  name: 'text',
  description: 'text'
}, {
  name: 'playlist_search_index',
  weights: {
    name: 3,
    description: 1
  },
  collation: {
    locale: 'en',
    strength: 2 // Case insensitive
  }
});

// Main category ve sub category kombinasyonu unique olmalı
playlistSchema.index({ mainCategory: 1, subCategory: 1 }, { unique: true });

module.exports = mongoose.model('Playlist', playlistSchema);