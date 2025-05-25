const Sample = require('../models/Sample');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const DownloadToken = require('../models/DownloadToken');
const apiBaseUrl = process.env.REACT_APP_API_BASE_URL;

// Configure multer
const multer = require('multer');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../assets/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

exports.upload = multer({ 
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.zip', '.mp3', '.wav'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only ZIP, MP3 and WAV files are allowed'));
    }
  }
});

// Add new sample
exports.addSample = async (req, res) => {
  try {
    const { name, category, price, paymentStatus } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const newSample = new Sample({
      name,
      category,
      price: parseFloat(price),
      paymentStatus: paymentStatus || 'free',
      fileName: req.file.originalname,
      filePath: req.file.path
    });

    await newSample.save();
    res.status(201).json(newSample);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get all samples
exports.getAllSamples = async (req, res) => {
  try {
    const samples = await Sample.find().sort({ createdAt: -1 });
    res.json(samples);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update payment status
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { sampleId } = req.params;
    const { paymentStatus } = req.body;

    const sample = await Sample.findByIdAndUpdate(
      sampleId,
      { paymentStatus },
      { new: true }
    );

    if (!sample) {
      return res.status(404).json({ error: 'Sample not found' });
    }

    res.json(sample);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Generate download token
exports.generateDownloadToken = async (req, res) => {
  try {
    const { sampleId } = req.body;
    const sample = await Sample.findById(sampleId);
    
    if (!sample) {
      return res.status(404).json({ error: 'Sample not found' });
    }

    const token = uuidv4();
    const newToken = new DownloadToken({ 
      token, 
      filePath: sample.filePath,
      fileName: sample.fileName,
      sampleId: sample._id
    });

    await newToken.save();

    res.json({ 
      downloadUrl: `${apiBaseUrl}/api/download/${token}`,
      fileName: sample.fileName,
      paymentStatus: sample.paymentStatus
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Serve download file
exports.downloadFile = async (req, res) => {
  try {
    const token = req.params.token;
    const record = await DownloadToken.findOne({ token });

    if (!record) {
      return res.status(403).send('Invalid download link');
    }

    res.download(record.filePath, record.fileName);
  } catch (err) {
    res.status(500).send('Download error');
  }
};