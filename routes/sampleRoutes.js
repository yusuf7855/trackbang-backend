// routes/sampleRoutes.js - DÜZELTİLMİŞ VERSİYONU

const express = require('express');
const router = express.Router();
const sampleController = require('../controllers/sampleController');

console.log('📂 SampleRoutes yükleniyor...');

// ============ MAIN SAMPLE ROUTES ============
// /api/samples prefix ile kullanılacak

// Ana sample işlemleri
router.post('/', sampleController.createSample);                    // POST /api/samples/
router.get('/', sampleController.getAllSamples);                    // GET /api/samples/
router.get('/stats', sampleController.getSampleStats);              // GET /api/samples/stats
router.get('/search', sampleController.searchSamples);              // GET /api/samples/search

// Specific sample operations (ID'li route'lar en sonda olmalı)
router.get('/:sampleId', sampleController.getSampleById);           // GET /api/samples/:sampleId
router.put('/:sampleId', sampleController.updateSample);            // PUT /api/samples/:sampleId
router.delete('/:sampleId', sampleController.deleteSample);         // DELETE /api/samples/:sampleId

// Payment status update
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

// ============ DOWNLOAD OPERATIONS - DÜZELTİLMİŞ SIRALAMA ============

// Download token generation - ÖNCE specific route
router.post('/download/generate', sampleController.generateDownloadToken); // POST /api/samples/download/generate

// Download file - SONRA parametreli route  
router.get('/download/:token', sampleController.downloadFile);             // GET /api/samples/download/:token

// ============ BACKWARD COMPATIBILITY ROUTES ============

// Legacy routes (deprecated but supported)
router.post('/add', sampleController.createSample);                       // POST /api/samples/add (deprecated)

console.log('✅ SampleRoutes yüklendi');

module.exports = router;