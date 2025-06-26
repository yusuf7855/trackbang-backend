// routes/storeRoutes.js
const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const authMiddleware = require('../middlewares/authMiddleware');

// Request logging middleware
router.use((req, res, next) => {
  console.log(`🏪 Store Route: ${req.method} ${req.originalUrl}`);
  next();
});

// ============ PUBLIC ROUTES (Mobile App) ============

// Get all active listings
router.get('/listings', storeController.getAllListings);

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

// Create new listing
router.post('/listings', authMiddleware, storeController.createListing);

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

module.exports = router;