const mongoose = require('mongoose');

const downloadTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  filePath: { type: String, required: true },
  fileName: { type: String, required: true },
  used: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('DownloadToken', downloadTokenSchema);