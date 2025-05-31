const express = require('express');
const router = express.Router();
const hotController = require('../controllers/hotController');

// HOT playlist routes (mobil uygulama için)
router.get('/', hotController.getHotPlaylists);
router.get('/category/:category', hotController.getHotPlaylistByCategory);
router.get('/stats', hotController.getHotStats);

module.exports = router;