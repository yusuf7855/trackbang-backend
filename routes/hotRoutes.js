const express = require('express');
const router = express.Router();
const hotController = require('../controllers/hotController');

// Public routes (for mobile app)
router.get('/', hotController.getAllHots);
router.get('/:id', hotController.getHotById);

// Admin routes (for panel)
router.post('/', hotController.createHot);
router.put('/:id', hotController.updateHot);
router.delete('/:id', hotController.deleteHot);
router.post('/:id/add-music', hotController.addMusicToHot);
router.post('/:id/remove-music', hotController.removeMusicFromHot);

module.exports = router;