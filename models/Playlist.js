const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: function() { 
      // Sadece kullanıcı playlist'leri için zorunlu
      return !this.isAdminPlaylist; 
    }
  },
  musics: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Music' 
  }],
  
  // ADMIN PLAYLIST ALANLARı
  isAdminPlaylist: {
    type: Boolean,
    default: false
  },
  // Ana kategori (sadece admin playlist'leri için)
  mainCategory: {
    type: String,
    enum: ['afrohouse', 'indiedance', 'organichouse', 'downtempo', 'melodichouse'],
    required: function() { return this.isAdminPlaylist; }
  },
  // Alt kategori/Katalog numarası (sadece admin playlist'leri için - AH1, MH1, vb.)
  subCategory: {
    type: String,
    uppercase: true,
    trim: true,
    required: function() { return this.isAdminPlaylist; }
  },
  
  // KULLANICI PLAYLIST ALANLARı
  // Normal genre (sadece kullanıcı playlist'leri için)
  genre: {
    type: String,
    enum: ['pop', 'rock', 'hiphop', 'jazz', 'classical', 'electronic', 'rnb', 'country', 'other'],
    required: function() { return !this.isAdminPlaylist; },
    default: 'other'
  },
  
  isPublic: {
    type: Boolean,
    default: function() { 
      return this.isAdminPlaylist ? true : false; // Admin playlist'ler otomatik public
    }
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

// Admin playlist'ler için main category ve sub category kombinasyonu unique olmalı
playlistSchema.index({ 
  mainCategory: 1, 
  subCategory: 1 
}, { 
  unique: true,
  partialFilterExpression: { isAdminPlaylist: true }
});

// Playlist türüne göre genre index
playlistSchema.index({ genre: 1, isPublic: 1 }, { 
  partialFilterExpression: { isAdminPlaylist: false }
});

module.exports = mongoose.model('Playlist', playlistSchema);