const express = require('express');
const router = express.Router();
const playlistController = require('../controllers/playlistController');
const authMiddleware = require('../middlewares/authMiddleware');

// Admin playlist routes (Panel için) - Authentication yok
router.post('/admin', playlistController.createAdminPlaylist);
router.get('/admin', playlistController.getAllAdminPlaylists);
router.put('/admin/:id', playlistController.updateAdminPlaylist);
router.delete('/admin/:id', playlistController.deleteAdminPlaylist); // Admin playlist silme

// User playlist routes (Mobil app için) - Authentication gerekli
router.post('/user', authMiddleware, playlistController.createUserPlaylist);
router.get('/user/:userId', playlistController.getUserPlaylists);
router.delete('/user/:id', authMiddleware, playlistController.deleteUserPlaylist); // User playlist silme

// Public routes
router.get('/public', playlistController.getPublicPlaylists);

// Category routes (Mobil app için - admin playlist'leri)
router.get('/category/:category', playlistController.getPlaylistsByCategory);
router.get('/hot/latest', playlistController.getLatestPlaylistsByCategory); // HOT sayfası için

module.exports = router;