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