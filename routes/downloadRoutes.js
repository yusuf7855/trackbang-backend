const express = require('express');
const router = express.Router();
const DownloadToken = require('../models/DownloadToken');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const apiBaseUrl = "https://trackbangserver.com.tr"

// Tek seferlik token oluşturma (test amaçlı örnek)
router.post('/generate', async (req, res) => {
  const token = uuidv4();
  const filePath = path.join(__dirname, '..', 'assets', 'test.mp3'); // assets klasöründeki test.zip dosyası

  const newToken = new DownloadToken({ token, filePath });
  await newToken.save();

  res.json({ downloadUrl: `${apiBaseUrl}/api/download/${token}` });
});

// İndirme linki
router.get('/:token', async (req, res) => {
  const token = req.params.token;
  const record = await DownloadToken.findOne({ token });

  if (!record || record.used) {
    return res.status(403).send('Bu bağlantı geçersiz veya zaten kullanıldı.');
  }

  const expired = (Date.now() - record.createdAt) > 10 * 60 * 1000;
  if (expired) {
    return res.status(410).send('Bağlantı süresi doldu.');
  }

  record.used = true;
  await record.save();

  res.download(record.filePath);
});

module.exports = router;
