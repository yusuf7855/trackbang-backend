const express = require('express');
const router = express.Router();
const playlistController = require('../controllers/playlistController');
const authMiddleware = require('../middlewares/authMiddleware');

// Admin playlist routes
router.post('/', authMiddleware, playlistController.createPlaylist);
router.get('/', playlistController.getAllPlaylists);
router.get('/user/:userId', playlistController.getUserPlaylists);
router.get('/category/:category', playlistController.getPlaylistsByCategory);
router.get('/hot/latest', playlistController.getLatestPlaylistsByCategory); // HOT sayfası için
router.put('/:id', authMiddleware, playlistController.updatePlaylist);
router.delete('/:id', authMiddleware, playlistController.deletePlaylist);

module.exports = router;