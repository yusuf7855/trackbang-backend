const express = require('express');
const router = express.Router();
const sampleController = require('../controllers/sampleController');

const upload = sampleController.upload.single('sampleFile');
router.post('/add', upload, sampleController.addSample);
router.get('/', sampleController.getAllSamples);
router.put('/:sampleId/payment-status', sampleController.updatePaymentStatus);
router.post('/download/generate', sampleController.generateDownloadToken);
router.get('/download/:token', sampleController.downloadFile);
router.delete('/:sampleId', async (req, res) => {
  const { sampleId } = req.params;
  try {
    const result = await require('../models/Sample').findByIdAndDelete(sampleId);
    if (!result) {
      return res.status(404).json({ error: 'Sample not found' });
    }
    res.json({ message: 'Sample deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
