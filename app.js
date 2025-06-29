// app.js - STATİK DOSYA SUNUMU DÜZELTMESİ

const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();

console.log('🚀 Server başlatılıyor...');

// ============ MIDDLEWARE SIRALAMA ÖNEMLİ! ============

// 1. CORS ayarları (EN ÖNCE)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// 2. Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============ STATİK DOSYA SUNUMU (ROUTES'TAN ÖNCE!) ============

// Uploads klasörü yollarını ayarla
const uploadsPath = path.join(__dirname, 'uploads');
const assetsPath = path.join(__dirname, 'assets');

console.log('📁 Uploads klasörü:', uploadsPath);
console.log('📁 Assets klasörü:', assetsPath);

// Klasörlerin varlığını kontrol et ve oluştur
if (!fs.existsSync(uploadsPath)) {
  console.log('📁 Uploads klasörü oluşturuluyor...');
  fs.mkdirSync(uploadsPath, { recursive: true });
}

if (!fs.existsSync(path.join(uploadsPath, 'store-listings'))) {
  console.log('📁 store-listings klasörü oluşturuluyor...');
  fs.mkdirSync(path.join(uploadsPath, 'store-listings'), { recursive: true });
}

// STATİK DOSYA MIDDLEWARE'LERİ - ROUTE'LARDAN ÖNCE OLMALI!
app.use('/uploads', express.static(uploadsPath, {
  setHeaders: (res, filePath, stat) => {
    console.log('📁 Statik dosya erişimi:', filePath);
    
    // CORS başlıkları
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Cache ayarları
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    // Dosya tipine göre Content-Type ayarla
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml'
    };
    
    if (mimeTypes[ext]) {
      res.setHeader('Content-Type', mimeTypes[ext]);
    }
  }
}));

app.use('/assets', express.static(assetsPath, {
  setHeaders: (res, filePath) => {
    console.log('📁 Asset dosya erişimi:', filePath);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));

// ============ DEBUG ENDPOINTS (STATİK DOSYALARDAN SONRA) ============

// Uploads klasör yapısını kontrol et
app.get('/debug/uploads', (req, res) => {
  try {
    const checkUploads = (dirPath, relativePath = '') => {
      if (!fs.existsSync(dirPath)) {
        return { exists: false, path: dirPath };
      }
      
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      const result = {
        exists: true,
        path: dirPath,
        relativePath: relativePath,
        files: [],
        directories: {}
      };
      
      items.forEach(item => {
        if (item.isDirectory()) {
          const subPath = path.join(dirPath, item.name);
          result.directories[item.name] = checkUploads(subPath, path.join(relativePath, item.name));
        } else {
          const stats = fs.statSync(path.join(dirPath, item.name));
          result.files.push({
            name: item.name,
            size: `${(stats.size / 1024).toFixed(2)} KB`,
            url: `${req.protocol}://${req.get('host')}/uploads${path.join(relativePath, item.name).replace(/\\/g, '/')}`
          });
        }
      });
      
      return result;
    };
    
    const structure = checkUploads(uploadsPath);
    
    res.json({
      success: true,
      message: 'Uploads klasörü analizi',
      baseUrl: `${req.protocol}://${req.get('host')}`,
      uploadsPath: uploadsPath,
      structure: structure
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      uploadsPath: uploadsPath
    });
  }
});

// Belirli resmi test et
app.get('/debug/test-image/:filename', (req, res) => {
  const filename = req.params.filename;
  const imagePath = path.join(uploadsPath, 'store-listings', filename);
  
  console.log('🧪 Resim test ediliyor:', imagePath);
  
  if (fs.existsSync(imagePath)) {
    const stats = fs.statSync(imagePath);
    res.json({
      success: true,
      message: 'Resim dosyası bulundu',
      file: {
        name: filename,
        path: imagePath,
        size: `${(stats.size / 1024).toFixed(2)} KB`,
        created: stats.birthtime,
        staticUrl: `${req.protocol}://${req.get('host')}/uploads/store-listings/${filename}`,
        directTest: `${req.protocol}://${req.get('host')}/debug/serve-image/${filename}`
      }
    });
  } else {
    res.json({
      success: false,
      message: 'Resim dosyası bulunamadı',
      searchedPath: imagePath,
      suggestion: 'Dosya adını kontrol edin'
    });
  }
});

// Resmi direkt servis et (test için)
app.get('/debug/serve-image/:filename', (req, res) => {
  const filename = req.params.filename;
  const imagePath = path.join(uploadsPath, 'store-listings', filename);
  
  console.log('🖼️ Direkt resim servisi:', imagePath);
  
  if (!fs.existsSync(imagePath)) {
    return res.status(404).json({
      success: false,
      message: 'Resim bulunamadı',
      path: imagePath
    });
  }
  
  // Dosya tipini belirle
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif'
  };
  
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  res.setHeader('Content-Type', contentType);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  
  const imageStream = fs.createReadStream(imagePath);
  imageStream.pipe(res);
  
  imageStream.on('error', (error) => {
    console.error('❌ Resim stream hatası:', error);
    res.status(500).json({ error: error.message });
  });
});

// ============ ROUTES (STATİK DOSYALARDAN SONRA) ============

const authRoutes = require('./routes/authRoutes');
const musicRoutes = require('./routes/musicRoutes');
const playlistRoutes = require('./routes/playlistRoutes');
const downloadRoutes = require('./routes/downloadRoutes');
const sampleRoutes = require('./routes/sampleRoutes');
const hotRoutes = require('./routes/hotRoutes');
const searchRoutes = require('./routes/searchRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const storeRoutes = require('./routes/storeRoutes');

console.log('📡 API Routes yükleniyor...');

// API Routes - SIRALAMA ÖNEMLİ!
app.use('/api/store', storeRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/hot', hotRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api', authRoutes);
app.use('/api/samples', sampleRoutes);

console.log('✅ API Routes yüklendi');

// ============ MONGODB CONNECTION ============

async function connectToMongoDB() {
  try {
    console.log('🔄 MongoDB\'ye bağlanılıyor...');
    
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI environment variable not found!');
    }
    
    const mongooseOptions = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 30000,
      maxPoolSize: 10,
      retryWrites: true,
      heartbeatFrequencyMS: 10000,
      family: 4
    };
    
    await mongoose.connect(process.env.MONGO_URI, mongooseOptions);
    
    console.log('✅ MongoDB bağlantısı başarılı!');
    console.log('📊 Database:', mongoose.connection.name || 'default');
    
    return true;
    
  } catch (error) {
    console.error('❌ MongoDB bağlantı hatası:', error.message);
    return false;
  }
}

// ============ ERROR HANDLING ============

// 404 handler - EN SONDA OLMALI
app.use('*', (req, res) => {
  console.log('❌ 404 - Route bulunamadı:', req.method, req.originalUrl);
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    availableEndpoints: {
      'Debug Uploads': '/debug/uploads',
      'Test Image': '/debug/test-image/FILENAME.webp',
      'Serve Image': '/debug/serve-image/FILENAME.webp',
      'Static Files': '/uploads/store-listings/FILENAME.webp',
      'API Store': '/api/store/listings'
    }
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error('💥 Global error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// ============ SERVER START ============

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // MongoDB bağlantısını kur
    const dbConnected = await connectToMongoDB();
    
    if (!dbConnected) {
      console.log('⚠️ MongoDB bağlantısı başarısız ama server başlatılıyor...');
    }
    
    // Server'ı başlat
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('🎉 =================================');
      console.log('🚀 SERVER BAŞARILI BİR ŞEKİLDE BAŞLADI!');
      console.log('🎉 =================================');
      console.log('');
      console.log(`📍 API Base URL: http://localhost:${PORT}`);
      console.log(`🖼️ Static Files: http://localhost:${PORT}/uploads`);
      console.log(`🔍 Debug Uploads: http://localhost:${PORT}/debug/uploads`);
      console.log(`🧪 Test Image: http://localhost:${PORT}/debug/test-image/6849ebb9f568eb5091e3acb6-1749675056129-382232772.webp`);
      console.log(`📁 Direct Image: http://localhost:${PORT}/uploads/store-listings/6849ebb9f568eb5091e3acb6-1749675056129-382232772.webp`);
      console.log('');
      console.log('💡 Resim URL test için:');
      console.log(`   curl -I http://localhost:${PORT}/uploads/store-listings/6849ebb9f568eb5091e3acb6-1749675056129-382232772.webp`);
      console.log('');
    });
    
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} zaten kullanılıyor!`);
        console.error('💡 Farklı bir port deneyin: PORT=3001 node app.js');
      } else {
        console.error('❌ Server hatası:', error.message);
      }
      process.exit(1);
    });
    
  } catch (error) {
    console.error('❌ Server başlatma hatası:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n📱 Server kapatılıyor...');
  mongoose.connection.close(() => {
    console.log('🔐 MongoDB bağlantısı kapatıldı');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\n📱 Server sonlandırılıyor...');
  mongoose.connection.close(() => {
    console.log('🔐 MongoDB bağlantısı kapatıldı');
    process.exit(0);
  });
});

// Unhandled promise rejection
process.on('unhandledRejection', (err) => {
  console.error('💥 Unhandled Promise Rejection:', err.message);
  process.exit(1);
});

// Uncaught exception
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err.message);
  process.exit(1);
});

// Server'ı başlat
startServer();

module.exports = app;