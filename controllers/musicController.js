const Music = require('../models/Music');
const Playlist = require('../models/Playlist'); // Bu satırı ekleyin

exports.getAllMusic = async (req, res) => {
  try {
    const music = await Music.find();
    res.json(music);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.likeMusic = async (req, res) => {
  try {
    const { userId } = req.body;
    const music = await Music.findById(req.params.id);
    
    if (!music) {
      return res.status(404).json({ message: 'Music not found' });
    }

    const userIndex = music.userLikes.indexOf(userId);
    if (userIndex === -1) {
      // Add like
      music.userLikes.push(userId);
      music.likes += 1;
    } else {
      // Remove like
      music.userLikes.splice(userIndex, 1);
      music.likes -= 1;
    }

    await music.save();
    res.json(music);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.addToPlaylist = async (req, res) => {
  try {
    const { playlistId, userId } = req.body;
    const musicId = req.params.id;

    // Check if music exists
    const music = await Music.findById(musicId);
    if (!music) {
      return res.status(404).json({ message: 'Music not found' });
    }

    // Check if playlist exists and belongs to user
    const playlist = await Playlist.findOne({ _id: playlistId, userId });
    if (!playlist) {
      return res.status(403).json({ message: 'Not authorized to modify this playlist or playlist not found' });
    }

    // Check if music already in playlist
    if (playlist.musics.includes(musicId)) {
      return res.status(400).json({ message: 'Music already in playlist' });
    }

    // Add music to playlist
    playlist.musics.push(musicId);
    await playlist.save();

    // Add playlist to music (optional, depends on your use case)
    music.playlists = music.playlists || [];
    if (!music.playlists.includes(playlistId)) {
      music.playlists.push(playlistId);
      await music.save();
    }

    res.json({
      success: true,
      message: 'Music added to playlist successfully',
      playlist: {
        id: playlist._id,
        name: playlist.name,
        musicCount: playlist.musics.length
      }
    });
  } catch (err) {
    console.error('Error adding to playlist:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while adding to playlist',
      error: err.message 
    });
  }
};

exports.getMusicByCategory = async (req, res) => {
  try {
    const category = req.params.category;
    const music = await Music.find({ category });
    res.json(music);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.addMusic = async (req, res) => {
  const { spotifyId, title, artist, beatportUrl, category } = req.body;

  try {
    const newMusic = new Music({ 
      spotifyId, 
      title,
      artist,
      beatportUrl, 
      category 
    });
    await newMusic.save();
    res.status(201).json(newMusic);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.updateMusic = async (req, res) => {
  try {
    const updatedMusic = await Music.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updatedMusic);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteMusic = async (req, res) => {
  try {
    await Music.findByIdAndDelete(req.params.id);
    res.json({ message: 'Music deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.searchMusicAndPlaylists = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ 
        message: 'Search query must be at least 2 characters long' 
      });
    }

    // Search both music and playlists in parallel
    const [musicResults, playlistResults] = await Promise.all([
      Music.find(
        { $text: { $search: query } },
        { score: { $meta: "textScore" } }
      ).sort({ score: { $meta: "textScore" } }),
      
      Playlist.find(
        { $text: { $search: query }, isPublic: true },
        { score: { $meta: "textScore" } }
      ).sort({ score: { $meta: "textScore" } })
    ]);

    res.json({
      success: true,
      music: musicResults,
      playlists: playlistResults
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error during search',
      error: err.message 
    });
  }
};

exports.searchMusic = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ 
        message: 'Search query must be at least 2 characters long' 
      });
    }

    const results = await Music.find(
      { $text: { $search: query } },
      { score: { $meta: "textScore" } }
    ).sort({ score: { $meta: "textScore" } });

    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.searchPrivateContent = async (req, res) => {
  try {
    const { query, userId } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ 
        message: 'Search query must be at least 2 characters long' 
      });
    }

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const [musicResults, playlistResults] = await Promise.all([
      Music.find(
        { $text: { $search: query } },
        { score: { $meta: "textScore" } }
      ).sort({ score: { $meta: "textScore" } }),
      
      Playlist.find(
        { 
          $text: { $search: query },
          userId,
          isPublic: false 
        },
        { score: { $meta: "textScore" } }
      ).sort({ score: { $meta: "textScore" } })
    ]);

    res.json({
      success: true,
      music: musicResults,
      playlists: playlistResults
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error during search',
      error: err.message 
    });
  }
};


exports.searchPublicContent = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.status(400).json({ 
        message: 'Search query must be at least 2 characters long' 
      });
    }

    const [musicResults, playlistResults] = await Promise.all([
      Music.find(
        { $text: { $search: query } },
        { score: { $meta: "textScore" } }
      ).sort({ score: { $meta: "textScore" } }),
      
      Playlist.find(
        { 
          $text: { $search: query },
          isPublic: true 
        },
        { score: { $meta: "textScore" } }
      ).sort({ score: { $meta: "textScore" } })
    ]);

    res.json({
      success: true,
      music: musicResults,
      playlists: playlistResults
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error during search',
      error: err.message 
    });
  }
};

// Get Top 10 most liked songs by category
exports.getTop10ByCategory = async (req, res) => {
  try {
    const categories = ['afrohouse', 'indiedance', 'organichouse', 'downtempo', 'melodichouse'];
    const top10Data = {};

    for (const category of categories) {
      const top10 = await Music.find({ category })
        .sort({ likes: -1 })
        .limit(10)
        .lean();

      top10Data[category] = top10.map((music, index) => ({
        _id: music._id,
        rank: index + 1,
        title: music.title,
        artist: music.artist,
        spotifyId: music.spotifyId,
        category: music.category,
        likes: music.likes || 0,
        userLikes: music.userLikes || [],
        beatportUrl: music.beatportUrl || '',
        createdAt: music.createdAt
      }));
    }

    // Overall top 10 across all categories
    const overallTop10 = await Music.find({})
      .sort({ likes: -1 })
      .limit(10)
      .lean();

    top10Data.all = overallTop10.map((music, index) => ({
      _id: music._id,
      rank: index + 1,
      title: music.title,
      artist: music.artist,
      spotifyId: music.spotifyId,
      category: music.category,
      likes: music.likes || 0,
      userLikes: music.userLikes || [],
      beatportUrl: music.beatportUrl || '',
      createdAt: music.createdAt
    }));

    res.json({
      success: true,
      top10: top10Data
    });
  } catch (err) {
    console.error('Error fetching top 10:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching top 10',
      error: err.message 
    });
  }
};

exports.searchMusicByArtist= async (req, res)  => {
  try {
    const { artist } = req.query;
    
    if (!artist || artist.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Sanatçı adı gerekli'
      });
    }

    const searchTerm = artist.trim();
    
    // Çoklu sanatçı desteği ile arama
    const musics = await Music.find({
      $or: [
        { artist: { $regex: searchTerm, $options: 'i' } }, // Backward compatibility
        { artists: { $regex: searchTerm, $options: 'i' } } // Yeni çoklu sanatçı desteği
      ]
    })
    .select('title artist artists category likes userLikes beatportUrl spotifyId')
    .sort({ likes: -1 }) // En çok beğenilenden sırala
    .limit(50) // Sanatçı araması için daha fazla sonuç
    .lean();

    // Sonuçları formatla
    const formattedMusics = musics.map(music => ({
      ...music,
      likeCount: music.likes || 0,
      // Display sanatçıları - yeni sistem varsa onu kullan, yoksa eski sistemi
      displayArtists: music.artists && music.artists.length > 0 
        ? music.artists.join(', ')
        : music.artist || 'Unknown Artist'
    }));

    res.json({
      success: true,
      musics: formattedMusics,
      count: formattedMusics.length
    });

  } catch (error) {
    console.error('Sanatçı arama hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sanatçı arama sırasında hata oluştu'
    });
  }
}

exports.getMusicPlaylistInfo = async (req, res) => {
  try {
    const { id: musicId } = req.params;
    
    if (!musicId) {
      return res.status(400).json({
        success: false,
        message: 'Müzik ID gerekli'
      });
    }

    // Müziğin var olup olmadığını kontrol et
    const music = await Music.findById(musicId).lean();
    if (!music) {
      return res.status(404).json({
        success: false,
        message: 'Müzik bulunamadı'
      });
    }

    // Bu müziği içeren playlist'leri bul
    const playlists = await Playlist.find({
      musics: musicId,
      $or: [
        { isPublic: true },
        { isAdminPlaylist: true }
      ]
    })
    .select('name category subCategory description _id isAdminPlaylist genre')
    .lean();

    if (playlists.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bu müzik herhangi bir public playlist\'te bulunamadı'
      });
    }

    // İlk bulduğu playlist'i (genellikle admin playlist) döndür
    const primaryPlaylist = playlists[0];
    
    // Güncellenmiş kategori başlığı mapping'i
    const categoryTitles = {
      // Eski kategoriler (backward compatibility)
      'Vocal Trance': 'Vocal Trance',
      'Uplifting': 'Uplifting',
      'Techno': 'Techno',
      'Progressive': 'Progressive',
      'PsyTrance': 'PsyTrance',
      'bigroom': 'Bigroom',
      'clubhits': 'Club Hits',
      
      // Yeni kategoriler (ListelerScreen'den gelen)
      'afrohouse': 'Afro House',
      'indiedance': 'Indie Dance',
      'organichouse': 'Organic House',
      'downtempo': 'Down Tempo',
      'melodichouse': 'Melodic House'
    };

    // Kategori alanını belirle (yeni sistemde 'genre', eski sistemde 'category')
    const categoryField = primaryPlaylist.genre || primaryPlaylist.category;
    const categoryTitle = categoryTitles[categoryField] || categoryField;

    res.json({
      success: true,
      playlist: {
        ...primaryPlaylist,
        category: categoryField, // CategoryPage'in beklediği alan
        categoryTitle: categoryTitle
      },
      allPlaylists: playlists.map(playlist => ({
        ...playlist,
        category: playlist.genre || playlist.category,
        categoryTitle: categoryTitles[playlist.genre || playlist.category] || (playlist.genre || playlist.category)
      }))
    });

  } catch (error) {
    console.error('Playlist bilgisi alma hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Playlist bilgisi alınırken hata oluştu'
    });
  }
}