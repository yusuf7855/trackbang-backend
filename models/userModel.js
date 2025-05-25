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
  // Güncellenmiş alanlar
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
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  resetToken: String,
  resetTokenExpire: Date
}, { timestamps: true });

// Validation: Maksimum 5 link
userSchema.pre('save', function(next) {
  if (this.profileLinks && this.profileLinks.length > 5) {
    const error = new Error('Maksimum 5 link ekleyebilirsiniz');
    error.name = 'ValidationError';
    return next(error);
  }
  next();
});

module.exports = mongoose.model('User', userSchema);