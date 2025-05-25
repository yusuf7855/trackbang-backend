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
  genre: {
    type: String,
    required: true,
    enum: ['pop', 'rock', 'hiphop', 'jazz', 'classical', 'electronic', 'rnb', 'country', 'other'],
    default: 'other'
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
module.exports = mongoose.model('Playlist', playlistSchema);