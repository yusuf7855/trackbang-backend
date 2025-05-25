const express = require('express');
const router = express.Router();
const playlistController = require('../controllers/playlistController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/', authMiddleware, playlistController.createPlaylist);
router.get('/user/:userId', playlistController.getUserPlaylists);
router.get('/public', playlistController.getPublicPlaylists);
router.get('/private', authMiddleware, playlistController.getPrivatePlaylists);
router.get('/search-private', authMiddleware, playlistController.searchPrivatePlaylists);

module.exports = router;