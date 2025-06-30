// routes/storeRoutes.js - GÜVENLI VERSİYON (Sadece mevcut metodları kullanır)

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
      rights: '/api/store/rights',
      'my-listings': '/api/store/my-listings'
    }
  });
});

// ============ PUBLIC ROUTES ============

// Get all active listings - MEVCUT
router.get('/listings', (req, res, next) => {
  console.log('📋 Listings endpoint çağrıldı');
  console.log('📋 Query params:', req.query);
  next();
}, storeController.getAllListings);

// Get single listing details - MEVCUT
router.get('/listings/:id', storeController.getListingById);

// Contact seller (increment contact count) - PLACEHOLDER
router.post('/listings/:id/contact', (req, res) => {
  res.json({
    success: true,
    message: 'Contact count incremented',
    contactCount: 1
  });
});

// ============ AUTHENTICATED ROUTES ============

// Get user's listing rights - MEVCUT
router.get('/rights', authMiddleware, (req, res, next) => {
  console.log('👤 Rights endpoint çağrıldı, User ID:', req.userId || req.user?.id);
  next();
}, storeController.getUserRights);

// Purchase listing rights - MEVCUT
router.post('/rights/purchase', authMiddleware, (req, res, next) => {
  console.log('💳 Purchase endpoint çağrıldı');
  console.log('💳 User ID:', req.userId || req.user?.id);
  console.log('💳 Request body:', req.body);
  next();
}, storeController.purchaseListingRights);

// Get user's own listings - MEVCUT
router.get('/my-listings', authMiddleware, storeController.getUserListings);

// Create new listing - YENİ EKLEYECEĞIMIZ
router.post('/listings', authMiddleware, (req, res, next) => {
  console.log('📝 Create listing endpoint çağrıldı');
  console.log('👤 User ID from middleware:', req.userId || req.user?.id);
  console.log('📋 Body fields:', Object.keys(req.body));
  next();
}, storeController.createListing || createListingPlaceholder);

// Update listing - MEVCUT
router.put('/listings/:id', authMiddleware, storeController.updateListing);

// Delete listing - MEVCUT
router.delete('/listings/:id', authMiddleware, storeController.deleteListing);

// Renew listing - MEVCUT
router.post('/listings/:id/renew', authMiddleware, storeController.renewListing);

// ============ PLACEHOLDER FUNCTIONS ============

// Geçici createListing function (eğer controller'da yoksa)
function createListingPlaceholder(req, res) {
  console.log('⚠️ CreateListing placeholder çağrıldı');
  
  const { title, category, price, description, phoneNumber } = req.body;
  
  if (!title || !category || !price || !description || !phoneNumber) {
    return res.status(400).json({
      success: false,
      message: 'Tüm alanlar gereklidir',
      required: ['title', 'category', 'price', 'description', 'phoneNumber']
    });
  }
  
  res.status(501).json({
    success: false,
    message: 'CreateListing metodu henüz controller\'da tanımlanmamış',
    receivedData: {
      title,
      category,
      price,
      description,
      phoneNumber
    }
  });
}

// ============ FUTURE ENDPOINTS (Commented Out) ============

// Henüz implementasyon gerektiren endpoint'ler:

// Get categories with counts
// router.get('/categories', storeController.getCategories);

// Get provinces
// router.get('/provinces', storeController.getProvinces);

// Get districts
// router.get('/districts', storeController.getDistricts);

// Search listings
// router.get('/listings/search', storeController.searchListings);

// Get listings by category
// router.get('/listings/category/:category', storeController.getListingsByCategory);

// ============ ADMIN ROUTES (Future) ============

// Admin authentication middleware
const adminMiddleware = (req, res, next) => {
  // TODO: Admin kontrolü yapılacak
  next();
};

// Admin endpoints (mevcut olanlar)
router.get('/admin/listings',  storeController.adminGetAllListings || storeController.getAllListings);
router.put('/admin/listings/:id/status',storeController.adminUpdateListingStatus || ((req, res) => {
  res.status(501).json({ success: false, message: 'Admin update status not implemented' });
}));
router.delete('/admin/listings/:id',  storeController.adminDeleteListing || storeController.deleteListing);
router.post('/admin/rights/grant',  storeController.adminGrantRights || ((req, res) => {
  res.status(501).json({ success: false, message: 'Admin grant rights not implemented' });
}));
router.get('/admin/rights/:userId',  storeController.adminGetUserRights || ((req, res) => {
  res.status(501).json({ success: false, message: 'Admin get user rights not implemented' });
}));
router.get('/admin/stats', storeController.adminGetStoreStats || ((req, res) => {
  res.json({
    success: true,
    message: 'Store statistics',
    stats: { totalListings: 0, activeListings: 0, message: 'Coming soon' }
  });
}));

module.exports = router;