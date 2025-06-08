// routes/searchRoutes.js - Yeni unified search routes
const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

// Genel arama endpoint'i (kullanıcı, playlist, müzik)
router.get('/all', searchController.searchAll);

// Sadece kullanıcı arama (eski endpoint backward compatibility için)
router.get('/users', authController.searchUsers);

// Kullanıcının kendi private playlist'lerinde arama
router.get('/my-playlists', authMiddleware, searchController.searchUserPrivatePlaylists);

module.exports = router;