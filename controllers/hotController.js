const Hot = require('../models/Hot');
const Music = require('../models/Music');

exports.createHot = async (req, res) => {
  try {
    const { name, description, musics, category, isActive, order } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Hot playlist name is required' });
    }

    // Validate musics exist
    if (musics && musics.length > 0) {
      const existingMusics = await Music.find({ _id: { $in: musics } });
      if (existingMusics.length !== musics.length) {
        return res.status(400).json({ message: 'Some music tracks do not exist' });
      }
    }

    const newHot = new Hot({
      name,
      description: description || '',
      musics: musics || [],
      category: category || 'all',
      isActive: isActive !== undefined ? isActive : true,
      order: order || 0
    });

    await newHot.save();
    
    const populatedHot = await Hot.findById(newHot._id)
      .populate({
        path: 'musics',
        select: 'title artist spotifyId category likes userLikes beatportUrl',
      });

    res.status(201).json({
      success: true,
      hot: populatedHot
    });
  } catch (err) {
    console.error('Error creating hot playlist:', err);
    res.status(400).json({ 
      message: 'Error creating hot playlist',
      error: err.message 
    });
  }
};

exports.getAllHots = async (req, res) => {
  try {
    const { category, isActive } = req.query;
    
    let filter = {};
    if (category && category !== 'all') {
      filter.category = category;
    }
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    const hots = await Hot.find(filter)
      .populate({
        path: 'musics',
        select: 'title artist spotifyId category likes userLikes beatportUrl',
      })
      .sort({ order: 1, createdAt: -1 })
      .lean();

    res.json({
      success: true,
      hots: hots.map(hot => ({
        _id: hot._id,
        name: hot.name,
        description: hot.description,
        category: hot.category,
        isActive: hot.isActive,
        order: hot.order,
        musicCount: hot.musics?.length || 0,
        musics: hot.musics?.map(music => ({
          _id: music._id,
          title: music.title,
          artist: music.artist,
          spotifyId: music.spotifyId,
          category: music.category,
          likes: music.likes || 0,
          userLikes: music.userLikes || [],
          beatportUrl: music.beatportUrl || ''
        })) || [],
        createdAt: hot.createdAt,
        updatedAt: hot.updatedAt
      }))
    });
  } catch (err) {
    console.error('Error fetching hot playlists:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching hot playlists',
      error: err.message 
    });
  }
};

exports.getHotById = async (req, res) => {
  try {
    const hot = await Hot.findById(req.params.id)
      .populate({
        path: 'musics',
        select: 'title artist spotifyId category likes userLikes beatportUrl',
      });

    if (!hot) {
      return res.status(404).json({ message: 'Hot playlist not found' });
    }

    res.json({
      success: true,
      hot: {
        _id: hot._id,
        name: hot.name,
        description: hot.description,
        category: hot.category,
        isActive: hot.isActive,
        order: hot.order,
        musicCount: hot.musics?.length || 0,
        musics: hot.musics?.map(music => ({
          _id: music._id,
          title: music.title,
          artist: music.artist,
          spotifyId: music.spotifyId,
          category: music.category,
          likes: music.likes || 0,
          userLikes: music.userLikes || [],
          beatportUrl: music.beatportUrl || ''
        })) || [],
        createdAt: hot.createdAt,
        updatedAt: hot.updatedAt
      }
    });
  } catch (err) {
    console.error('Error fetching hot playlist:', err);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching hot playlist',
      error: err.message 
    });
  }
};

exports.updateHot = async (req, res) => {
  try {
    const { name, description, musics, category, isActive, order } = req.body;

    // Validate musics exist if provided
    if (musics && musics.length > 0) {
      const existingMusics = await Music.find({ _id: { $in: musics } });
      if (existingMusics.length !== musics.length) {
        return res.status(400).json({ message: 'Some music tracks do not exist' });
      }
    }

    const updatedHot = await Hot.findByIdAndUpdate(
      req.params.id,
      {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(musics && { musics }),
        ...(category && { category }),
        ...(isActive !== undefined && { isActive }),
        ...(order !== undefined && { order }),
        updatedAt: Date.now()
      },
      { new: true }
    ).populate({
      path: 'musics',
      select: 'title artist spotifyId category likes userLikes beatportUrl',
    });

    if (!updatedHot) {
      return res.status(404).json({ message: 'Hot playlist not found' });
    }

    res.json({
      success: true,
      hot: updatedHot
    });
  } catch (err) {
    console.error('Error updating hot playlist:', err);
    res.status(400).json({ 
      message: 'Error updating hot playlist',
      error: err.message 
    });
  }
};

exports.deleteHot = async (req, res) => {
  try {
    const deletedHot = await Hot.findByIdAndDelete(req.params.id);

    if (!deletedHot) {
      return res.status(404).json({ message: 'Hot playlist not found' });
    }

    res.json({
      success: true,
      message: 'Hot playlist deleted successfully'
    });
  } catch (err) {
    console.error('Error deleting hot playlist:', err);
    res.status(500).json({ 
      message: 'Error deleting hot playlist',
      error: err.message 
    });
  }
};

exports.addMusicToHot = async (req, res) => {
  try {
    const { musicId } = req.body;
    const hotId = req.params.id;

    // Check if music exists
    const music = await Music.findById(musicId);
    if (!music) {
      return res.status(404).json({ message: 'Music not found' });
    }

    // Check if hot playlist exists
    const hot = await Hot.findById(hotId);
    if (!hot) {
      return res.status(404).json({ message: 'Hot playlist not found' });
    }

    // Check if music already in hot playlist
    if (hot.musics.includes(musicId)) {
      return res.status(400).json({ message: 'Music already in hot playlist' });
    }

    // Add music to hot playlist
    hot.musics.push(musicId);
    hot.updatedAt = Date.now();
    await hot.save();

    const updatedHot = await Hot.findById(hotId)
      .populate({
        path: 'musics',
        select: 'title artist spotifyId category likes userLikes beatportUrl',
      });

    res.json({
      success: true,
      message: 'Music added to hot playlist successfully',
      hot: updatedHot
    });
  } catch (err) {
    console.error('Error adding music to hot playlist:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while adding music to hot playlist',
      error: err.message 
    });
  }
};

exports.removeMusicFromHot = async (req, res) => {
  try {
    const { musicId } = req.body;
    const hotId = req.params.id;

    const hot = await Hot.findById(hotId);
    if (!hot) {
      return res.status(404).json({ message: 'Hot playlist not found' });
    }

    // Remove music from hot playlist
    hot.musics = hot.musics.filter(id => id.toString() !== musicId);
    hot.updatedAt = Date.now();
    await hot.save();

    const updatedHot = await Hot.findById(hotId)
      .populate({
        path: 'musics',
        select: 'title artist spotifyId category likes userLikes beatportUrl',
      });

    res.json({
      success: true,
      message: 'Music removed from hot playlist successfully',
      hot: updatedHot
    });
  } catch (err) {
    console.error('Error removing music from hot playlist:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server error while removing music from hot playlist',
      error: err.message 
    });
  }
};