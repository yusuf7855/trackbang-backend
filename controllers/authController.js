const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const ipSessions = require('../ipSessions');
const sendResetEmail = require('../utils/sendResetEmail');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Multer konfigürasyonu
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, req.userId + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Profil resmi yükleme
exports.uploadProfileImage = (req, res, next) => {
  const singleUpload = upload.single('profileImage');
  singleUpload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: err.message });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// Çoklu resim yükleme
exports.uploadAdditionalImages = (req, res, next) => {
  const multiUpload = upload.array('additionalImages', 3);
  multiUpload(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: err.message });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }
    next();
  });
};

// Mevcut updateProfileImage fonksiyonunu güncelleyin
exports.updateProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Lütfen bir resim dosyası seçin' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Eski resmi sil (varsa ve default resim değilse)
    if (user.profileImage && user.profileImage !== 'image.jpg') {
      const oldImagePath = path.join(__dirname, '../uploads', user.profileImage);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // Yeni resim yolunu güncelle
    user.profileImage = req.file.filename;
    await user.save();

    res.json({ 
      message: 'Profil resmi başarıyla güncellendi',
      profileImage: `/uploads/${user.profileImage}`
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Yeni: Ek resimler yükleme
exports.uploadUserAdditionalImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'Lütfen en az bir resim dosyası seçin' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Yeni resimleri ekle
    const newImages = req.files.map(file => ({
      filename: file.filename,
      uploadDate: new Date()
    }));

    // Maksimum 3 resim limiti
    const totalImages = user.additionalImages.length + newImages.length;
    if (totalImages > 3) {
      return res.status(400).json({ message: 'Maksimum 3 ek resim yükleyebilirsiniz' });
    }

    user.additionalImages.push(...newImages);
    await user.save();

    res.json({ 
      message: 'Resimler başarıyla yüklendi',
      additionalImages: user.additionalImages.map(img => ({
        filename: img.filename,
        url: `/uploads/${img.filename}`,
        uploadDate: img.uploadDate
      }))
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Yeni: Profil güncelleme
exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, bio, profileLinks, events } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Güncelleme
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (bio !== undefined) {
      if (bio.length > 300) {
        return res.status(400).json({ message: 'Bio 300 karakterden uzun olamaz' });
      }
      user.bio = bio;
    }
    
    // Profil linklerini güncelle
    if (profileLinks && Array.isArray(profileLinks)) {
      if (profileLinks.length > 5) {
        return res.status(400).json({ message: 'Maksimum 5 link ekleyebilirsiniz' });
      }
      
      user.profileLinks = profileLinks.map(link => ({
        title: link.title.substring(0, 50), // Başlık 50 karakter sınırı
        url: link.url,
        createdAt: link.createdAt || new Date()
      }));
    }

    // Etkinlikleri güncelle
    if (events && Array.isArray(events)) {
      user.events = events.map(event => ({
        date: new Date(event.date),
        time: event.time,
        city: event.city,
        venue: event.venue
      }));
    }

    await user.save();

    res.json({
      message: 'Profil başarıyla güncellendi',
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        bio: user.bio,
        profileLinks: user.profileLinks,
        events: user.events,
        additionalImages: user.additionalImages,
        profileImage: user.profileImage
      }
    });
  } catch (err) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
};

// Yeni: Ek resim silme
exports.deleteAdditionalImage = async (req, res) => {
  try {
    const { filename } = req.params;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    // Resmi listeden kaldır
    user.additionalImages = user.additionalImages.filter(img => img.filename !== filename);
    
    // Dosyayı sil
    const filePath = path.join(__dirname, '../uploads', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await user.save();

    res.json({ message: 'Resim başarıyla silindi' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.register = async (req, res) => {
  const { username , email, password, phone, firstName, lastName } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  try {
    const newUser = new User({ 
      username,
      email, 
      password: hashed,
      phone,
      firstName,
      lastName
    });
    await newUser.save();
    res.status(201).json({ message: 'Kayıt başarılı' });
  } catch (err) {
    res.status(400).json({ message: 'Kayıt başarısız', error: err.message });
  }
};

exports.login = async (req, res) => {
  console.log('Request body:', req.body); 
  const { email, password } = req.body;
  const ip = req.ip;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Kullanıcı bulunamadı' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Şifre yanlış' });

    const token = jwt.sign({ userId: user._id }, "supersecretkey", { expiresIn: '1h' });
    
    res.json({ 
      token, 
      userId: user._id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      message: 'Giriş başarılı' 
    });
  } catch (err) {
    res.status(500).json({ message: 'Sunucu hatası', error: err.message });
  }
};

exports.logout = (req, res) => {
  const ip = req.ip;
  ipSessions.logout(ip);
  res.json({ message: 'Çıkış başarılı' });
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) return res.status(400).json({ message: 'Kullanıcı bulunamadı' });

  const token = Math.random().toString(36).substring(2);
  user.resetToken = token;
  user.resetTokenExpire = Date.now() + 3600000; // 1 saat
  await user.save();

  await sendResetEmail(email, token);

  res.json({ message: 'Şifre sıfırlama bağlantısı gönderildi' });
};

exports.searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.trim().length < 1) {
      return res.json([]);
    }
    
    const searchTerm = query.trim();
    
    const users = await User.find({
      $or: [
        { username: { $regex: searchTerm, $options: 'i' } },
        { firstName: { $regex: searchTerm, $options: 'i' } },
        { lastName: { $regex: searchTerm, $options: 'i' } },
        { 
          $expr: {
            $regexMatch: {
              input: { $concat: ["$firstName", " ", "$lastName"] },
              regex: searchTerm,
              options: "i"
            }
          }
        }
      ]
    }).select('username firstName lastName profileImage bio').limit(20);
    
    console.log(`Search query: "${searchTerm}", Found ${users.length} users`); // Debug log
    
    // ProfileImage path'ini düzelt
    const usersWithImage = users.map(user => ({
      ...user.toObject(),
      profileImage: user.profileImage && user.profileImage !== 'image.jpg' 
        ? user.profileImage 
        : null
    }));
    
    res.json(usersWithImage);
  } catch (err) {
    console.error('Search error:', err); // Debug log
    res.status(500).json({ message: err.message });
  }
};

exports.followUser = async (req, res) => {
  try {
    const { userId } = req;
    const { targetUserId } = req.params;

    if (userId === targetUserId) {
      return res.status(400).json({ message: 'Kendini takip edemezsin' });
    }

    const [user, targetUser] = await Promise.all([
      User.findById(userId),
      User.findById(targetUserId)
    ]);

    if (!targetUser) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }

    if (!user.following.includes(targetUserId)) {
      user.following.push(targetUserId);
      targetUser.followers.push(userId);
      await Promise.all([user.save(), targetUser.save()]);
    }

    res.json({ message: 'Takip işlemi başarılı' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.unfollowUser = async (req, res) => {
  try {
    const { userId } = req;
    const { targetUserId } = req.params;

    await Promise.all([
      User.findByIdAndUpdate(userId, { $pull: { following: targetUserId } }),
      User.findByIdAndUpdate(targetUserId, { $pull: { followers: userId } })
    ]);

    res.json({ message: 'Takipten çıkıldı' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Güncellenmiş getUserById - public profil görüntüleme için
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -resetToken -resetTokenExpire -email -phone')
      .populate('followers', 'username firstName lastName profileImage')
      .populate('following', 'username firstName lastName profileImage');
    
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }
    
    // ProfileImage path'ini düzelt
    const userWithImage = {
      ...user.toObject(),
      profileImage: user.profileImage && user.profileImage !== 'image.jpg' 
        ? user.profileImage 
        : null,
      // Ek resimler için URL'leri düzelt
      additionalImages: user.additionalImages?.map(img => ({
        filename: img.filename,
        url: `/uploads/${img.filename}`,
        uploadDate: img.uploadDate
      })) || []
    };
    
    res.json(userWithImage);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select('-password -resetToken -resetTokenExpire')
      .populate('followers', 'username firstName lastName profileImage')
      .populate('following', 'username firstName lastName profileImage');
    
    if (!user) {
      return res.status(404).json({ message: 'Kullanıcı bulunamadı' });
    }
    
    // ProfileImage path'ini düzelt
    const userWithImage = {
      ...user.toObject(),
      profileImage: user.profileImage && user.profileImage !== 'image.jpg' 
        ? user.profileImage 
        : null,
      // Ek resimler için URL'leri düzelt
      additionalImages: user.additionalImages?.map(img => ({
        filename: img.filename,
        url: `/uploads/${img.filename}`,
        uploadDate: img.uploadDate
      })) || []
    };
    
    res.json(userWithImage);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};