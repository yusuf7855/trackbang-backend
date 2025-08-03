// routes/storeRoutes.js - MULTER YAPITLANDIRMASI DÜZELTİLMİŞ

const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const authMiddleware = require('../middlewares/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// uploads klasörünü oluştur (eğer yoksa)
const uploadsDir = 'uploads/store-listings/';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration for image uploads - DÜZELTİLMİŞ
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/store-listings/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit (5MB'dan artırdık)
    files: 5 // Maximum 5 files
  },
  fileFilter: function (req, file, cb) {
    console.log('🖼️ Dosya kontrol ediliyor:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });

    // DAHA KAPSAMLI MİMETYPE KONTROLÜ
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/tiff'
    ];

    // Dosya uzantısı kontrolü
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff'];
    const fileExtension = path.extname(file.originalname).toLowerCase();

    console.log('📋 Dosya bilgileri:', {
      mimetype: file.mimetype,
      extension: fileExtension,
      allowedMimeTypes: allowedMimeTypes.includes(file.mimetype),
      allowedExtensions: allowedExtensions.includes(fileExtension)
    });

    if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
      console.log('✅ Dosya kabul edildi:', file.originalname);
      cb(null, true);
    } else {
      console.log('❌ Dosya reddedildi:', file.originalname, 'MIME:', file.mimetype, 'EXT:', fileExtension);
      const error = new Error(`Desteklenmeyen dosya türü: ${file.mimetype}. Sadece resim dosyaları (.jpg, .jpeg, .png, .gif, .webp) yüklenebilir.`);
      error.code = 'INVALID_FILE_TYPE';
      cb(error, false);
    }
  }
});

// Request logging middleware
router.use((req, res, next) => {
  console.log(`🏪 Store Route: ${req.method} ${req.originalUrl}`);
  console.log(`🏪 Headers:`, req.headers.authorization ? 'Auth present' : 'No auth');
  console.log(`🏪 Body:`, req.method === 'POST' ? Object.keys(req.body) : 'N/A');
  next();
});

// ============ TEST & DEBUG ROUTES ============

// Test endpoint - backend bağlantısını kontrol et
router.get('/test', storeController.testConnection);

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Store service is healthy',
    timestamp: new Date().toISOString(),
    endpoints: {
      test: '/api/store/test',
      listings: '/api/store/listings',
      rights: '/api/store/rights',
      'my-listings': '/api/store/my-listings'
    }
  });
});

// ============ PUBLIC ROUTES ============

// Get all active listings
router.get('/listings', (req, res, next) => {
  console.log('📋 Listings endpoint çağrıldı');
  console.log('📋 Query params:', req.query);
  next();
}, storeController.getAllListings);

// Get single listing details
router.get('/listings/:id', storeController.getListingById);

// Contact seller (increment contact count)
router.post('/listings/:id/contact', (req, res) => {
  res.json({
    success: true,
    message: 'Contact count incremented',
    contactCount: 1
  });
});

// ============ AUTHENTICATED ROUTES ============

// Get user's listing rights
router.get('/rights', authMiddleware, (req, res, next) => {
  console.log('👤 Rights endpoint çağrıldı, User ID:', req.userId || req.user?.id);
  next();
}, storeController.getUserRights);

// Purchase listing rights
router.post('/rights/purchase', authMiddleware, (req, res, next) => {
  console.log('💳 Purchase endpoint çağrıldı');
  console.log('💳 User ID:', req.userId || req.user?.id);
  console.log('💳 Request body:', req.body);
  next();
}, storeController.purchaseListingRights);

// Get user's own listings
router.get('/my-listings', authMiddleware, storeController.getUserListings);

// Create new listing - DOSYA YÜKLEME İLE
router.post('/listings', 
  authMiddleware, 
  (req, res, next) => {
    console.log('📝 Create listing endpoint çağrıldı');
    console.log('👤 User ID from middleware:', req.userId || req.user?.id);
    console.log('📋 Body fields:', Object.keys(req.body));
    next();
  },
  upload.array('images', 5), // Multer middleware
  (req, res, next) => {
    console.log('📷 Files uploaded:', req.files ? req.files.length : 0);
    if (req.files) {
      req.files.forEach((file, index) => {
        console.log(`📷 File ${index + 1}:`, {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size,
          filename: file.filename
        });
      });
    }
    next();
  },
  storeController.createListing
);

// Update listing
router.put('/listings/:id', authMiddleware, storeController.updateListing);

// Delete listing
router.delete('/listings/:id', authMiddleware, storeController.deleteListing);

// Renew listing
router.post('/listings/:id/renew', authMiddleware, storeController.renewListing);

// ============ ADMIN ROUTES (Future Implementation) ============

const adminMiddleware = (req, res, next) => {
  console.log('🔒 Admin middleware - TODO: Implement admin check');
  next();
};

router.get('/admin/listings', authMiddleware, adminMiddleware, storeController.getAllListings);

router.put('/admin/listings/:id/status', authMiddleware, adminMiddleware, (req, res) => {
  res.status(501).json({ 
    success: false, 
    message: 'Admin update status not implemented yet' 
  });
});

router.delete('/admin/listings/:id', authMiddleware, adminMiddleware, storeController.deleteListing);

router.post('/admin/rights/grant', authMiddleware, adminMiddleware, (req, res) => {
  res.status(501).json({ 
    success: false, 
    message: 'Admin grant rights not implemented yet' 
  });
});

router.get('/admin/rights/:userId', authMiddleware, adminMiddleware, (req, res) => {
  res.status(501).json({ 
    success: false, 
    message: 'Admin get user rights not implemented yet' 
  });
});

router.get('/admin/stats', authMiddleware, adminMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Store statistics',
    stats: { 
      totalListings: 0, 
      activeListings: 0, 
      totalUsers: 0,
      message: 'Admin stats coming soon' 
    }
  });
});

// ============ ERROR HANDLING MIDDLEWARE ============

router.use((error, req, res, next) => {
  console.error('🚨 Store route error:', error);

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Dosya boyutu çok büyük (maksimum 10MB)',
        error: 'FILE_TOO_LARGE'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Çok fazla dosya (maksimum 5 dosya)',
        error: 'TOO_MANY_FILES'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        message: 'Beklenmeyen dosya alanı',
        error: 'UNEXPECTED_FILE_FIELD'
      });
    }
  }
  
  if (error.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      message: error.message,
      error: 'INVALID_FILE_TYPE'
    });
  }
  
  res.status(500).json({
    success: false,
    message: 'Dosya yükleme hatası',
    error: 'production' === 'production' ? error.message : 'Internal server error'
  });
});

module.exports = router;