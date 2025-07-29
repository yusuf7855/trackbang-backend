// app.js - STATİK DOSYA SUNUMU DÜZELTMESİ + ANA SAYFA

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

// ============ ANA SAYFA - SERVER DURUMU ============

app.get('/', (req, res) => {
  const serverInfo = {
    status: 'active',
    message: 'Server çalışıyor! 🚀',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    uptimeFormatted: `${Math.floor(process.uptime() / 3600)}s ${Math.floor((process.uptime() % 3600) / 60)}d ${Math.floor(process.uptime() % 60)}s`,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    port: process.env.PORT || 5000,
    database: {
      connected: mongoose.connection.readyState === 1,
      status: mongoose.connection.readyState === 1 ? 'Bağlı' : 'Bağlantısız',
      name: mongoose.connection.name || 'Bilinmiyor'
    },
    endpoints: {
      health: `${req.protocol}://${req.get('host')}/health`,
      apiStore: `${req.protocol}://${req.get('host')}/api/store/listings`,
      apiMessages: `${req.protocol}://${req.get('host')}/api/messages/health`,
      debugUploads: `${req.protocol}://${req.get('host')}/debug/uploads`,
      staticFiles: `${req.protocol}://${req.get('host')}/uploads`,
      testImage: `${req.protocol}://${req.get('host')}/debug/test-image/example.webp`
    }
  };

  // HTML response için tarayıcıdan geliyorsa
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    const html = `
    <!DOCTYPE html>
    <html lang="tr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Server Durumu</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: #000000;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #ffffff;
                margin: 0;
                padding: 20px;
            }
            .container {
                background: #111111;
                border: 2px solid #333333;
                border-radius: 15px;
                padding: 40px;
                max-width: 800px;
                width: 100%;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            }
            .status-badge {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                border-radius: 25px;
                font-weight: 600;
                margin-bottom: 20px;
            }
            .status-badge.active {
                background: #22c55e;
                color: #ffffff;
            }
            .status-badge.inactive {
                background: #ef4444;
                color: #ffffff;
            }
            .status-dot {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                animation: pulse 2s infinite;
            }
            .status-dot.active {
                background: #ffffff;
            }
            .status-dot.inactive {
                background: #ffffff;
            }
            @keyframes pulse {
                0% { opacity: 1; }
                50% { opacity: 0.5; }
                100% { opacity: 1; }
            }
            h1 { 
                font-size: 2.5rem; 
                margin-bottom: 10px;
                color: #ffffff;
                font-weight: 700;
            }
            .info-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                gap: 20px;
                margin: 30px 0;
            }
            .info-card {
                background: #222222;
                padding: 20px;
                border-radius: 10px;
                border: 1px solid #444444;
            }
            .info-card h3 {
                color: #ffffff;
                margin-bottom: 10px;
                font-size: 1.1rem;
                font-weight: 600;
            }
            .info-card p {
                font-size: 0.9rem;
                color: #cccccc;
                line-height: 1.4;
            }
            .endpoints {
                margin-top: 30px;
            }
            .endpoint-list {
                display: grid;
                gap: 10px;
                margin-top: 15px;
            }
            .endpoint-item {
                background: #222222;
                padding: 12px 16px;
                border-radius: 8px;
                border-left: 4px solid #ffffff;
                border: 1px solid #444444;
            }
            .endpoint-item a {
                color: #cccccc;
                text-decoration: none;
                font-family: 'Courier New', monospace;
                font-size: 0.9rem;
            }
            .endpoint-item a:hover {
                color: #ffffff;
            }
            .database-status {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .db-indicator {
                width: 10px;
                height: 10px;
                border-radius: 50%;
            }
            .db-indicator.connected {
                background: #22c55e;
            }
            .db-indicator.disconnected {
                background: #ef4444;
            }
            .refresh-btn {
                background: #ffffff;
                color: #000000;
                border: none;
                padding: 12px 24px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                margin-top: 20px;
                transition: all 0.2s;
            }
            .refresh-btn:hover {
                background: #cccccc;
                transform: translateY(-1px);
            }
            .timestamp {
                text-align: center;
                color: #888888;
                font-size: 0.8rem;
                margin-top: 20px;
                font-family: 'Courier New', monospace;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="status-badge ${mongoose.connection.readyState === 1 ? 'active' : 'inactive'}">
                <div class="status-dot ${mongoose.connection.readyState === 1 ? 'active' : 'inactive'}"></div>
                <span>${mongoose.connection.readyState === 1 ? 'AKTİF' : 'PASİF'}</span>
            </div>
            
            <h1>Server Çalışıyor! 🚀</h1>
            <p style="opacity: 0.8; margin-bottom: 20px;">Sunucunuz başarıyla çalışıyor ve istekleri işlemeye hazır.</p>
            
            <div class="info-grid">
                <div class="info-card">
                    <h3>⚡ Sunucu Bilgileri</h3>
                    <p><strong>Port:</strong> ${serverInfo.port}</p>
                    <p><strong>Ortam:</strong> ${serverInfo.environment}</p>
                    <p><strong>Node.js:</strong> ${serverInfo.nodeVersion}</p>
                    <p><strong>Çalışma Süresi:</strong> ${serverInfo.uptimeFormatted}</p>
                </div>
                
                <div class="info-card">
                    <h3>🗄️ Veritabanı</h3>
                    <div class="database-status">
                        <div class="db-indicator ${mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'}"></div>
                        <p><strong>Durum:</strong> ${serverInfo.database.status}</p>
                    </div>
                    <p><strong>Veritabanı:</strong> ${serverInfo.database.name}</p>
                </div>
            </div>
            
            <button class="refresh-btn" onclick="window.location.reload()">
                🔄 Yenile
            </button>
            
            <div class="timestamp">
                Son güncelleme: ${new Date().toLocaleString('tr-TR')}
            </div>
        </div>
        
        <script>
            // Auto refresh every 30 seconds
            setTimeout(() => {
                window.location.reload();
            }, 30000);
        </script>
    </body>
    </html>
    `;
    
    res.send(html);
  } else {
    // JSON response için API çağrıları
    res.json({
      success: true,
      ...serverInfo
    });
  }
});

// ============ SAĞLIK KONTROL ENDPOINT'İ ============

app.get('/health', (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    database: {
      connected: mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState
    },
    environment: process.env.NODE_ENV || 'development'
  };
  
  const statusCode = mongoose.connection.readyState === 1 ? 200 : 503;
  
  res.status(statusCode).json({
    success: mongoose.connection.readyState === 1,
    ...healthCheck
  });
});

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
const messageRoutes = require('./routes/messageRoutes'); // YENİ EKLEME
const paymentRoutes = require('./routes/paymentRoutes');

console.log('📡 API Routes yükleniyor...');

// API Routes - SIRALAMA ÖNEMLİ!
app.use('/api/payments', paymentRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/hot', hotRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/messages', messageRoutes); // YENİ EKLEME
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
      'Home': '/',
      'Health Check': '/health',
      'Debug Uploads': '/debug/uploads',
      'Test Image': '/debug/test-image/FILENAME.webp',
      'Serve Image': '/debug/serve-image/FILENAME.webp',
      'Static Files': '/uploads/store-listings/FILENAME.webp',
      'API Store': '/api/store/listings',
      'API Messages': '/api/messages/health',
      'API Messages Send': '/api/messages/send',
      'API Messages Conversations': '/api/messages/conversations'
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