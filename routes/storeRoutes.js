// routes/storeRoutes.js - DÜZELTİLMİŞ VERSİYONU

const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const authMiddleware = require('../middlewares/authMiddleware');

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
      categories: '/api/store/categories',
      rights: '/api/store/rights',
      purchase: '/api/store/rights/purchase'
    }
  });
});

// ============ PUBLIC ROUTES (Mobile App) ============

// Get all active listings - Ana endpoint
router.get('/listings', (req, res, next) => {
  console.log('📋 Listings endpoint çağrıldı');
  console.log('📋 Query params:', req.query);
  next();
}, storeController.getAllListings);

// Get listings by category
router.get('/listings/category/:category', storeController.getListingsByCategory || storeController.getAllListings);

// Search listings
router.get('/listings/search', storeController.searchListings);

// Get single listing details
router.get('/listings/:id', storeController.getListingById);

// Get categories with counts
router.get('/categories', storeController.getCategories);

// Contact seller (increment contact count)
router.post('/listings/:id/contact', storeController.contactSeller);

// ============ USER AUTHENTICATED ROUTES (Mobile App) ============

// Get user's listing rights - DÜZELTİLMİŞ endpoint
router.get('/rights', authMiddleware, (req, res, next) => {
  console.log('👤 Rights endpoint çağrıldı, User ID:', req.userId || req.user?.id);
  next();
}, storeController.getUserRights);

// Purchase listing rights - DÜZELTİLMİŞ endpoint
router.post('/rights/purchase', authMiddleware, (req, res, next) => {
  console.log('💳 Purchase endpoint çağrıldı');
  console.log('💳 User ID:', req.userId || req.user?.id);
  console.log('💳 Request body:', req.body);
  next();
}, storeController.purchaseListingRights);

// Get user's own listings
router.get('/my-listings', authMiddleware, storeController.getUserListings);

// Create new listing - DÜZELTİLMİŞ endpoint
router.post('/listings', authMiddleware, (req, res, next) => {
  console.log('📝 Create listing endpoint çağrıldı');
  console.log('👤 User ID from middleware:', req.userId || req.user?.id);
  console.log('📁 Files:', req.files ? `${req.files.length} files` : 'No files');
  console.log('📋 Body fields:', Object.keys(req.body));
  next();
}, storeController.createListing);

// Update listing
router.put('/listings/:id', authMiddleware, storeController.updateListing);

// Delete listing
router.delete('/listings/:id', authMiddleware, storeController.deleteListing);

// Renew/reactivate listing
router.post('/listings/:id/renew', authMiddleware, storeController.renewListing);

// ============ ADMIN PANEL ROUTES ============

// Admin authentication middleware (isteğe bağlı - admin kontrolü için)
const adminMiddleware = (req, res, next) => {
  // Burada admin kontrolü yapılabilir
  // Şimdilik tüm authenticated kullanıcılara izin veriyoruz
  next();
};

// Get all listings for admin (with filters)
router.get('/admin/listings', authMiddleware, adminMiddleware, storeController.adminGetAllListings);

// Update listing status (admin only)
router.put('/admin/listings/:id/status', authMiddleware, adminMiddleware, storeController.adminUpdateListingStatus);

// Delete listing (admin only)
router.delete('/admin/listings/:id', authMiddleware, adminMiddleware, storeController.adminDeleteListing);

// Grant listing rights to user (admin only)
router.post('/admin/rights/grant', authMiddleware, adminMiddleware, storeController.adminGrantRights);

// Get user rights info (admin only)
router.get('/admin/rights/:userId', authMiddleware, adminMiddleware, storeController.adminGetUserRights);

// Get store statistics (admin only)
router.get('/admin/stats', authMiddleware, adminMiddleware, storeController.adminGetStoreStats);

// ============ UTILITY ROUTES ============

// Get listing by number
router.get('/listing-number/:listingNumber', async (req, res) => {
  try {
    const { listingNumber } = req.params;
    const listing = await require('../models/StoreListing').findOne({ 
      listingNumber,
      status: 'active',
      isActive: true
    }).populate('userId', 'username email');
    
    if (!listing) {
      return res.status(404).json({
        success: false,
        message: 'Listing not found'
      });
    }
    
    res.json({
      success: true,
      listing: {
        ...listing.toJSON(),
        images: listing.images.map(img => ({
          ...img,
          url: `/uploads/store-listings/${img.filename}`
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching listing',
      error: error.message
    });
  }
});

// Get user statistics
router.get('/user/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || req.user?.id;
    const StoreListing = require('../models/StoreListing');
    const ListingRights = require('../models/ListingRights');
    
    const totalListings = await StoreListing.countDocuments({ userId });
    const activeListings = await StoreListing.countDocuments({ 
      userId, 
      status: 'active', 
      isActive: true 
    });
    const expiredListings = await StoreListing.countDocuments({ 
      userId, 
      expiryDate: { $lt: new Date() } 
    });
    
    const rights = await ListingRights.findOne({ userId });
    
    const totalViews = await StoreListing.aggregate([
      { $match: { userId: require('mongoose').Types.ObjectId(userId) } },
      { $group: { _id: null, total: { $sum: '$viewCount' } } }
    ]);
    
    const totalContacts = await StoreListing.aggregate([
      { $match: { userId: require('mongoose').Types.ObjectId(userId) } },
      { $group: { _id: null, total: { $sum: '$contactCount' } } }
    ]);
    
    res.json({
      success: true,
      stats: {
        listings: {
          total: totalListings,
          active: activeListings,
          expired: expiredListings
        },
        rights: {
          total: rights?.totalRights || 0,
          used: rights?.usedRights || 0,
          available: rights?.availableRights || 0
        },
        engagement: {
          totalViews: totalViews[0]?.total || 0,
          totalContacts: totalContacts[0]?.total || 0
        }
      }
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user stats',
      error: error.message
    });
  }
});

// ============ ERROR HANDLING ============

// Global error handling middleware for store routes
router.use((error, req, res, next) => {
  console.error('🚨 Store Route Error:', error);
  
  // Multer errors
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
      message: 'Çok fazla dosya (maksimum 5 resim)',
      error: 'TOO_MANY_FILES'
    });
  }
  
  if (error.message && (error.message.includes('Only image files') || error.message.includes('Sadece resim dosyaları'))) {
    return res.status(400).json({
      success: false,
      message: 'Sadece resim dosyaları kabul edilir (JPEG, PNG, GIF, WEBP, BMP, TIFF, SVG, ICO, HEIC, HEIF)',
      error: 'INVALID_FILE_TYPE'
    });
  }
  
  // Mongoose validation errors
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map(err => err.message);
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: messages,
      error: 'VALIDATION_ERROR'
    });
  }
  
  // Mongoose cast errors
  if (error.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
      error: 'INVALID_ID'
    });
  }
  
  // Duplicate key errors
  if (error.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Duplicate entry',
      error: 'DUPLICATE_ENTRY'
    });
  }
  
  // Generic error
  res.status(500).json({
    success: false,
    message: 'Store service error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
});

// 404 handler for undefined routes
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Store route not found: ${req.method} ${req.originalUrl}`,
    availableRoutes: {
      'GET /api/store/listings': 'Get all listings',
      'POST /api/store/listings': 'Create new listing',
      'GET /api/store/rights': 'Get user rights',
      'POST /api/store/rights/purchase': 'Purchase rights',
      'GET /api/store/categories': 'Get categories',
      'GET /api/store/test': 'Test connection'
    }
  });
});

module.exports = router;