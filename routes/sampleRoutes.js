// routes/sampleRoutes.js
const express = require('express');
const router = express.Router();
const sampleController = require('../controllers/sampleController');

// Sample CRUD operations
router.post('/samples', sampleController.createSample);
router.get('/samples', sampleController.getAllSamples);
router.get('/samples/stats', sampleController.getSampleStats);
router.get('/samples/search', sampleController.searchSamples);
router.get('/samples/:sampleId', sampleController.getSampleById);
router.put('/samples/:sampleId', sampleController.updateSample);
router.delete('/samples/:sampleId', sampleController.deleteSample);

// Download operations
router.post('/samples/download/generate', sampleController.generateDownloadToken);
router.get('/download/:token', sampleController.downloadFile);

// Backward compatibility routes
router.post('/add', sampleController.createSample);
router.get('/', sampleController.getAllSamples);
router.put('/:sampleId/payment-status', async (req, res) => {
  try {
    const { sampleId } = req.params;
    const { paymentStatus } = req.body;
    
    const Sample = require('../models/Sample');
    const updatedSample = await Sample.findByIdAndUpdate(
      sampleId,
      { paymentStatus },
      { new: true }
    );
    
    if (!updatedSample) {
      return res.status(404).json({ error: 'Sample not found' });
    }
    
    res.json({
      success: true,
      message: 'Payment status updated',
      sample: updatedSample
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/download/generate', sampleController.generateDownloadToken);
router.delete('/:sampleId', sampleController.deleteSample);

module.exports = router;