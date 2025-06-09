// routes/musicRoutes.js - Güncellenmiş routes
const express = require('express');
const router = express.Router();
const musicController = require('../controllers/musicController');

// Genel routes
router.get('/', musicController.getAllMusic);
router.get('/top10', musicController.getTop10ByCategory);
router.get('/category/:category', musicController.getMusicByCategory);

// Arama routes
router.get('/search', musicController.searchMusic);
router.get('/search-private', musicController.searchPrivateContent);
router.get('/search-public', musicController.searchPublicContent);

// CRUD operations
router.post('/', musicController.addMusic);
router.put('/:id', musicController.updateMusic);
router.delete('/:id', musicController.deleteMusic);

// Interaction routes
router.post('/:id/like', musicController.likeMusic);
router.post('/:id/add-to-playlist', musicController.addToPlaylist);

module.exports = router;