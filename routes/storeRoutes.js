// routes/storeRoutes.js - DÜZELTİLMİŞ VERSIYONU

const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const authMiddleware = require('../middlewares/authMiddleware');

// Request logging middleware
router.use((req, res, next) => {
  console.log(`🏪 Store Route: ${req.method} ${req.originalUrl}`);
  console.log(`🏪 Headers:`, req.headers.authorization ? 'Auth present' : 'No auth');
  console.log(`🏪 Query:`, req.query);
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
      rights: '/api/store/rights'
    }
  });
});

// ============ PUBLIC ROUTES (Mobile App) ============

// Get all active listings - Ana endpoint
router.get('/listings', (req, res, next) => {
  console.log('📋 Listings endpoint çağrıldı');
  next();
}, storeController.getAllListings);

// Get listings by category
router.get('/listings/category/:category', storeController.getListingsByCategory);

// Search listings
router.get('/listings/search', storeController.searchListings);

// Get single listing details
router.get('/listings/:id', storeController.getListingById);

// Get categories with counts
router.get('/categories', storeController.getCategories);

// Contact seller (increment contact count)
router.post('/listings/:id/contact', storeController.contactSeller);

// ============ USER AUTHENTICATED ROUTES (Mobile App) ============

// Get user's listing rights
router.get('/rights', authMiddleware, storeController.getUserRights);

// Purchase listing rights
router.post('/rights/purchase', authMiddleware, storeController.purchaseListingRights);

// Get user's own listings
router.get('/my-listings', authMiddleware, storeController.getUserListings);

// Create new listing - Dosya upload endpoint
router.post('/listings', authMiddleware, (req, res, next) => {
  console.log('📝 Create listing endpoint çağrıldı');
  console.log('👤 User ID from middleware:', req.userId || req.user?.id);
  next();
}, storeController.createListing);

// Update listing
router.put('/listings/:id', authMiddleware, storeController.updateListing);

// Delete listing
router.delete('/listings/:id', authMiddleware, storeController.deleteListing);

// Renew/reactivate listing
router.post('/listings/:id/renew', authMiddleware, storeController.renewListing);

// ============ ADMIN PANEL ROUTES ============

// Get all listings for admin (with filters)
router.get('/admin/listings', storeController.adminGetAllListings);

// Update listing status (admin only)
router.put('/admin/listings/:id/status', storeController.adminUpdateListingStatus);

// Delete listing (admin only)
router.delete('/admin/listings/:id', storeController.adminDeleteListing);

// Grant listing rights to user (admin only)
router.post('/admin/rights/grant', storeController.adminGrantRights);

// Get user rights info (admin only)
router.get('/admin/rights/:userId', storeController.adminGetUserRights);

// Get store statistics (admin only)
router.get('/admin/stats', storeController.adminGetStoreStats);

// ============ ERROR HANDLING ============

// Error handling middleware
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
  
  if (error.message.includes('Only image files') || error.message.includes('Sadece resim dosyaları')) {
    return res.status(400).json({
      success: false,
      message: 'Sadece resim dosyaları kabul edilir (JPEG, PNG, GIF, WEBP, BMP, TIFF, SVG, ICO, HEIC, HEIF)',
      error: 'INVALID_FILE_TYPE'
    });
  }
  
  // Generic error
  res.status(500).json({
    success: false,
    message: 'Store service error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  });
});

module.exports = router;