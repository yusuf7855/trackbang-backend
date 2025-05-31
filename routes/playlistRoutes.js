const express = require('express');
const router = express.Router();
const playlistController = require('../controllers/playlistController');
const authMiddleware = require('../middlewares/authMiddleware');

// Admin playlist routes (Panel için)
router.post('/admin', authMiddleware, playlistController.createAdminPlaylist);
router.get('/admin', playlistController.getAllAdminPlaylists);
router.put('/admin/:id', authMiddleware, playlistController.updateAdminPlaylist);

// User playlist routes (Mobil app için)
router.post('/user', authMiddleware, playlistController.createUserPlaylist);
router.get('/user/:userId', playlistController.getUserPlaylists);
router.get('/public', playlistController.getPublicPlaylists);

// Category routes (Mobil app için - admin playlist'leri)
router.get('/category/:category', playlistController.getPlaylistsByCategory);
router.get('/hot/latest', playlistController.getLatestPlaylistsByCategory); // HOT sayfası için

// Common routes
router.delete('/:id', authMiddleware, playlistController.deletePlaylist);

module.exports = router;