const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const authRoutes = require('./routes/authRoutes');
const musicRoutes = require('./routes/musicRoutes');
const cors = require('cors');
const playlistRoutes = require('./routes/playlistRoutes');
const downloadRoutes = require('./routes/downloadRoutes');
const sampleRoutes = require('./routes/sampleRoutes');
dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());
app.use('/api', sampleRoutes);
app.use('/api', authRoutes);
app.use('/api/download', downloadRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/assets', express.static('assets'));
app.use('/uploads', express.static('uploads'));

mongoose.connect("mongodb+srv://221118047:9KY5zsMHQRJyEwGq@cluster0.rz2m5a4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => {
    console.log('MongoDB bağlantısı başarılı.');
    app.listen(5000, () => console.log('Server 5000 portunda çalışıyor.'));
  })
  .catch((err) => console.error('MongoDB bağlantı hatası:', err));