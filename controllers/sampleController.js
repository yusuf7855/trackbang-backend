// controllers/sampleController.js
const Sample = require('../models/Sample');
const DownloadToken = require('../models/DownloadToken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const apiBaseUrl = process.env.API_BASE_URL || 'https://trackbangserver.com.tr';

// Multer configuration for multiple file types
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath;
    
    if (file.fieldname === 'image') {
      uploadPath = 'uploads/sample-images/';
    } else if (file.fieldname === 'demoFile') {
      uploadPath = 'uploads/sample-demos/';
    } else if (file.fieldname === 'mainContent') {
      uploadPath = 'uploads/sample-content/';
    } else {
      uploadPath = 'uploads/';
    }
    
    // Klasör yoksa oluştur
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'image') {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Sadece resim dosyaları kabul edilir'), false);
    }
  } else if (file.fieldname === 'demoFile') {
    if (file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/mp3') {
      cb(null, true);
    } else {
      cb(new Error('Demo dosyası sadece MP3 formatında olmalıdır'), false);
    }
  } else if (file.fieldname === 'mainContent') {
    if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Ana içerik sadece ZIP formatında olmalıdır'), false);
    }
  } else {
    cb(new Error('Bilinmeyen dosya alanı'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// Middleware for handling multiple file uploads
const uploadFiles = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'demoFile', maxCount: 1 },
  { name: 'mainContent', maxCount: 1 }
]);

// Create new sample
exports.createSample = async (req, res) => {
  uploadFiles(req, res, async function (err) {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ error: err.message });
    }

    try {
      const { title, genre, price } = req.body;

      // Dosya kontrolü
      if (!req.files || !req.files.image || !req.files.demoFile || !req.files.mainContent) {
        return res.status(400).json({ 
          error: 'Tüm dosyalar gereklidir (görsel, demo MP3, ana içerik ZIP)' 
        });
      }

      const imageFile = req.files.image[0];
      const demoFile = req.files.demoFile[0];
      const mainContentFile = req.files.mainContent[0];

      const sampleData = {
        title,
        genre,
        price: parseFloat(price) || 0,
        
        // Image
        imageUrl: `${apiBaseUrl}/uploads/sample-images/${imageFile.filename}`,
        imagePath: imageFile.path,
        
        // Demo file
        demoUrl: `${apiBaseUrl}/uploads/sample-demos/${demoFile.filename}`,
        demoPath: demoFile.path,
        demoFileName: demoFile.filename,
        
        // Main content
        mainContentUrl: `${apiBaseUrl}/uploads/sample-content/${mainContentFile.filename}`,
        mainContentPath: mainContentFile.path,
        mainContentFileName: mainContentFile.filename,
        
        // File sizes
        fileSize: {
          demo: demoFile.size,
          mainContent: mainContentFile.size
        }
      };

      const sample = new Sample(sampleData);
      await sample.save();

      res.status(201).json({
        success: true,
        message: 'Sample başarıyla oluşturuldu',
        sample: sample
      });

    } catch (error) {
      console.error('Sample creation error:', error);
      
      // Hata durumunda yüklenen dosyaları temizle
      if (req.files) {
        Object.values(req.files).forEach(fileArray => {
          fileArray.forEach(file => {
            if (fs.existsSync(file.path)) {
              fs.unlinkSync(file.path);
            }
          });
        });
      }
      
      res.status(500).json({ 
        error: 'Sample oluşturulurken hata oluştu: ' + error.message 
      });
    }
  });
};

// Update existing sample
exports.updateSample = async (req, res) => {
  uploadFiles(req, res, async function (err) {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ error: err.message });
    }

    try {
      const { sampleId } = req.params;
      const { title, genre, price } = req.body;

      const existingSample = await Sample.findById(sampleId);
      if (!existingSample) {
        return res.status(404).json({ error: 'Sample bulunamadı' });
      }

      const updateData = {
        title: title || existingSample.title,
        genre: genre || existingSample.genre,
        price: price !== undefined ? parseFloat(price) : existingSample.price
      };

      // Yeni dosyalar varsa güncelle
      if (req.files && req.files.image) {
        const imageFile = req.files.image[0];
        // Eski dosyayı sil
        if (fs.existsSync(existingSample.imagePath)) {
          fs.unlinkSync(existingSample.imagePath);
        }
        updateData.imageUrl = `${apiBaseUrl}/uploads/sample-images/${imageFile.filename}`;
        updateData.imagePath = imageFile.path;
      }

      if (req.files && req.files.demoFile) {
        const demoFile = req.files.demoFile[0];
        // Eski dosyayı sil
        if (fs.existsSync(existingSample.demoPath)) {
          fs.unlinkSync(existingSample.demoPath);
        }
        updateData.demoUrl = `${apiBaseUrl}/uploads/sample-demos/${demoFile.filename}`;
        updateData.demoPath = demoFile.path;
        updateData.demoFileName = demoFile.filename;
        updateData['fileSize.demo'] = demoFile.size;
      }

      if (req.files && req.files.mainContent) {
        const mainContentFile = req.files.mainContent[0];
        // Eski dosyayı sil
        if (fs.existsSync(existingSample.mainContentPath)) {
          fs.unlinkSync(existingSample.mainContentPath);
        }
        updateData.mainContentUrl = `${apiBaseUrl}/uploads/sample-content/${mainContentFile.filename}`;
        updateData.mainContentPath = mainContentFile.path;
        updateData.mainContentFileName = mainContentFile.filename;
        updateData['fileSize.mainContent'] = mainContentFile.size;
      }

      const updatedSample = await Sample.findByIdAndUpdate(
        sampleId, 
        updateData, 
        { new: true }
      );

      res.json({
        success: true,
        message: 'Sample başarıyla güncellendi',
        sample: updatedSample
      });

    } catch (error) {
      console.error('Sample update error:', error);
      res.status(500).json({ 
        error: 'Sample güncellenirken hata oluştu: ' + error.message 
      });
    }
  });
};

// Get all samples
exports.getAllSamples = async (req, res) => {
  try {
    const { genre, minPrice, maxPrice, sortBy = 'createdAt', order = 'desc' } = req.query;
    
    let filter = {};
    
    if (genre && genre !== 'all') {
      filter.genre = genre;
    }
    
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice !== undefined) filter.price.$lte = parseFloat(maxPrice);
    }

    const sortOptions = {};
    sortOptions[sortBy] = order === 'desc' ? -1 : 1;

    const samples = await Sample.find(filter)
      .sort(sortOptions)
      .lean();

    res.json(samples);
  } catch (error) {
    console.error('Get samples error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get sample by ID
exports.getSampleById = async (req, res) => {
  try {
    const { sampleId } = req.params;
    const sample = await Sample.findById(sampleId);
    
    if (!sample) {
      return res.status(404).json({ error: 'Sample bulunamadı' });
    }

    // View sayısını artır
    await sample.incrementViews();

    res.json(sample);
  } catch (error) {
    console.error('Get sample by ID error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Delete sample
exports.deleteSample = async (req, res) => {
  try {
    const { sampleId } = req.params;
    const sample = await Sample.findById(sampleId);
    
    if (!sample) {
      return res.status(404).json({ error: 'Sample bulunamadı' });
    }

    // Dosyaları sil
    const filesToDelete = [
      sample.imagePath,
      sample.demoPath,
      sample.mainContentPath
    ];

    filesToDelete.forEach(filePath => {
      if (filePath && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error('Dosya silinirken hata:', err);
        }
      }
    });

    // Database'den sil
    await Sample.findByIdAndDelete(sampleId);

    res.json({
      success: true,
      message: 'Sample başarıyla silindi'
    });
  } catch (error) {
    console.error('Delete sample error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Search samples
exports.searchSamples = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.status(400).json({ error: 'Arama sorgusu gereklidir' });
    }

    const samples = await Sample.searchSamples(q);
    res.json(samples);
  } catch (error) {
    console.error('Search samples error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Generate download token for main content
exports.generateDownloadToken = async (req, res) => {
  try {
    const { sampleId } = req.body;
    console.log('Token generation request for sampleId:', sampleId);
    
    const sample = await Sample.findById(sampleId);
    
    if (!sample) {
      console.log('Sample not found:', sampleId);
      return res.status(404).json({ error: 'Sample bulunamadı' });
    }

    // Dosya yolu kontrolü
    if (!sample.mainContentPath) {
      console.log('Main content path not found for sample:', sampleId);
      return res.status(404).json({ error: 'Dosya yolu bulunamadı' });
    }

    // Ücretli sample kontrolü (gerçek uygulamada ödeme kontrolü yapılacak)
    if (sample.paymentStatus === 'paid' && sample.price > 0) {
      // Burada ödeme kontrolü yapılabilir
      console.log('Paid sample download requested:', sampleId);
    }

    const token = uuidv4();
    const newToken = new DownloadToken({ 
      token, 
      filePath: sample.mainContentPath,
      fileName: sample.mainContentFileName || `sample_${sampleId}.zip`,
      sampleId: sample._id
    });

    await newToken.save();
    console.log('Token created and saved:', token);

    // DÜZELTME: Doğru port numarasını kullan
    const baseUrl =  'https://trackbangserver.com.tr';
    
    const response = {
      token: token,
      downloadUrl: `${baseUrl}/api/download/${token}`,
      fileName: sample.mainContentFileName || `sample_${sampleId}.zip`,
      paymentStatus: sample.paymentStatus
    };

    console.log('Response to client:', response);
    res.json(response);
    
  } catch (error) {
    console.error('Generate download token error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Download file using token - DÜZELTME
exports.downloadFile = async (req, res) => {
  try {
    const token = req.params.token;
    console.log('Download request for token:', token);
    
    const record = await DownloadToken.findOne({ token, used: false });

    if (!record) {
      console.log('Invalid or used token:', token);
      return res.status(403).json({ error: 'Geçersiz veya kullanılmış indirme bağlantısı' });
    }

    console.log('Token record found:', record);
    
    // Dosya kontrolü
    if (!fs.existsSync(record.filePath)) {
      console.log('File not found at path:', record.filePath);
      return res.status(404).json({ error: 'Dosya bulunamadı' });
    }

    // Download sayısını artır
    if (record.sampleId) {
      const sample = await Sample.findById(record.sampleId);
      if (sample) {
        await sample.incrementDownloads();
        console.log('Download count incremented for sample:', record.sampleId);
      }
    }

    // Token'ı kullanılmış olarak işaretle
    record.used = true;
    await record.save();
    console.log('Token marked as used:', token);

    // Dosyayı indir
    console.log('Sending file:', record.filePath);
    res.download(record.filePath, record.fileName, (err) => {
      if (err) {
        console.error('File download error:', err);
      } else {
        console.log('File sent successfully:', record.fileName);
      }
    });
    
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).json({ error: 'İndirme hatası: ' + error.message });
  }
};
// Download file using token
exports.downloadFile = async (req, res) => {
  try {
    const token = req.params.token;
    const record = await DownloadToken.findOne({ token, used: false });

    if (!record) {
      return res.status(403).send('Geçersiz veya kullanılmış indirme bağlantısı');
    }

    if (!fs.existsSync(record.filePath)) {
      return res.status(404).send('Dosya bulunamadı');
    }

    // Download sayısını artır
    if (record.sampleId) {
      const sample = await Sample.findById(record.sampleId);
      if (sample) {
        await sample.incrementDownloads();
      }
    }

    // Token'ı kullanılmış olarak işaretle
    record.used = true;
    await record.save();

    res.download(record.filePath, record.fileName);
  } catch (error) {
    console.error('Download file error:', error);
    res.status(500).send('İndirme hatası');
  }
};

// Get sample statistics
exports.getSampleStats = async (req, res) => {
  try {
    const stats = await Promise.all([
      Sample.countDocuments(),
      Sample.countDocuments({ paymentStatus: 'free' }),
      Sample.countDocuments({ paymentStatus: 'paid' }),
      Sample.aggregate([
        { $group: { _id: '$genre', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Sample.aggregate([
        { $group: { _id: null, totalDownloads: { $sum: '$downloads' } } }
      ])
    ]);

    res.json({
      totalSamples: stats[0],
      freeSamples: stats[1],
      paidSamples: stats[2],
      genreStats: stats[3],
      totalDownloads: stats[4][0]?.totalDownloads || 0
    });
  } catch (error) {
    console.error('Get sample stats error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Backward compatibility functions
exports.addSample = exports.createSample;
exports.upload = { single: () => uploadFiles };

module.exports = exports;