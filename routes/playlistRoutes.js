const express = require('express');
const router = express.Router();
const playlistController = require('../controllers/playlistController');
const authMiddleware = require('../middlewares/authMiddleware');

// Public routes (authentication gerektirmeyen)
router.get('/public', playlistController.getPublicPlaylists);
router.get('/public-world', playlistController.getPublicWorldPlaylists);
router.get('/category/:category', playlistController.getPlaylistsByCategory);
router.get('/user/:userId', playlistController.getUserPlaylists);
router.get('/following/:userId', playlistController.getFollowingPlaylists);

// Admin playlist routes (Panel için) - Authentication yok
router.post('/admin', playlistController.createAdminPlaylist);
router.get('/admin', playlistController.getAllAdminPlaylists);
router.put('/admin/:id', playlistController.updateAdminPlaylist);
router.delete('/admin/:id', playlistController.deleteAdminPlaylist);

// User playlist routes (Mobil app için) - Authentication gerekli
router.post('/', authMiddleware, playlistController.createUserPlaylist); // Ana route
router.delete('/user/:id', authMiddleware, playlistController.deleteUserPlaylist);

// HOT sayfası için routes
router.get('/hot/latest', playlistController.getLatestPlaylistsByCategory);

// Search routes
router.get('/search-private', authMiddleware, playlistController.searchPrivatePlaylists);

module.exports = router;