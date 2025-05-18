const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, path.join(__dirname, '../public/uploads'));
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'community-' + uniqueSuffix + ext);
  }
});

// Configure multer for community image uploads
const upload = multer({
  storage: storage,
  fileFilter: function(req, file, cb) {
    // Only check file type, no size limits
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Get all communities
router.get('/', (req, res) => {
  const userId = req.user.id;
  
  db.all(`
    SELECT 
      c.*,
      (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) as member_count,
      EXISTS(SELECT 1 FROM community_members WHERE community_id = c.id AND user_id = ?) as is_member
    FROM communities c
    ORDER BY member_count DESC
  `, [userId], (err, communities) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching communities', error: err.message });
    }
    
    res.json({ communities });
  });
});

// Get communities user is a member of
router.get('/my-communities', (req, res) => {
  const userId = req.user.id;
  
  db.all(`
    SELECT 
      c.*,
      (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) as member_count,
      1 as is_member
    FROM communities c
    JOIN community_members cm ON c.id = cm.community_id
    WHERE cm.user_id = ?
    ORDER BY c.name
  `, [userId], (err, communities) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching communities', error: err.message });
    }
    
    res.json({ communities });
  });
});

// Create a new community
router.post('/', (req, res) => {
  const { name, description } = req.body;
  const userId = req.user.id;
  
  if (!name) {
    return res.status(400).json({ message: 'Community name is required' });
  }
  
  // Insert into communities table
  db.run('INSERT INTO communities (name, description, admin_id) VALUES (?, ?, ?)',
    [name, description || '', userId],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error creating community', error: err.message });
      }
      
      const communityId = this.lastID;
      
      // Add creator as a member
      db.run('INSERT INTO community_members (community_id, user_id) VALUES (?, ?)',
        [communityId, userId],
        (err) => {
          if (err) {
            console.error('Error adding creator as member:', err.message);
          }
        }
      );
      
      // Add to community search
      db.run('INSERT INTO community_search (rowid, name, description) VALUES (?, ?, ?)',
        [communityId, name, description || ''],
        (err) => {
          if (err) {
            console.error('Error adding to community search:', err.message);
          }
        }
      );
      
      // Get the created community
      db.get(
        `SELECT 
          c.*,
          1 as member_count,
          1 as is_member
        FROM communities c
        WHERE c.id = ?`,
        [communityId],
        (err, community) => {
          if (err) {
            return res.status(500).json({ message: 'Error fetching created community', error: err.message });
          }
          
          res.status(201).json({
            message: 'Community created successfully',
            community
          });
        }
      );
    }
  );
});

// Get a specific community
router.get('/:id', (req, res) => {
  const communityId = req.params.id;
  const userId = req.user.id;
  
  db.get(
    `SELECT 
      c.*,
      (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) as member_count,
      EXISTS(SELECT 1 FROM community_members WHERE community_id = c.id AND user_id = ?) as is_member,
      (c.admin_id = ?) as is_admin
    FROM communities c
    WHERE c.id = ?`,
    [userId, userId, communityId],
    (err, community) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching community', error: err.message });
      }
      
      if (!community) {
        return res.status(404).json({ message: 'Community not found' });
      }
      
      res.json({ community });
    }
  );
});

// Join a community
router.post('/:id/join', (req, res) => {
  const communityId = req.params.id;
  const userId = req.user.id;
  
  // Check if community exists
  db.get('SELECT * FROM communities WHERE id = ?', [communityId], (err, community) => {
    if (err) {
      return res.status(500).json({ message: 'Error checking community', error: err.message });
    }
    
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }
    
    // Check if already a member
    db.get(
      'SELECT * FROM community_members WHERE community_id = ? AND user_id = ?',
      [communityId, userId],
      (err, membership) => {
        if (err) {
          return res.status(500).json({ message: 'Error checking membership', error: err.message });
        }
        
        if (membership) {
          return res.status(400).json({ message: 'Already a member of this community' });
        }
        
        // Join the community
        db.run(
          'INSERT INTO community_members (community_id, user_id) VALUES (?, ?)',
          [communityId, userId],
          function(err) {
            if (err) {
              return res.status(500).json({ message: 'Error joining community', error: err.message });
            }
            
            // Notify community admin
            if (community.admin_id !== userId) {
              db.get('SELECT username FROM users WHERE id = ?', [userId], (err, user) => {
                if (!err && user) {
                  db.run(
                    'INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, ?, ?, ?)',
                    [
                      community.admin_id,
                      'community_join',
                      `${user.username} joined your community "${community.name}"`,
                      communityId
                    ]
                  );
                }
              });
            }
            
            res.json({ message: 'Joined community successfully' });
          }
        );
      }
    );
  });
});

// Leave a community
router.post('/:id/leave', (req, res) => {
  const communityId = req.params.id;
  const userId = req.user.id;
  
  // Check if community exists
  db.get('SELECT * FROM communities WHERE id = ?', [communityId], (err, community) => {
    if (err) {
      return res.status(500).json({ message: 'Error checking community', error: err.message });
    }
    
    if (!community) {
      return res.status(404).json({ message: 'Community not found' });
    }
    
    // Check if admin (admins can't leave their own communities)
    if (community.admin_id === userId) {
      return res.status(400).json({ message: 'Admins cannot leave their own communities. Transfer ownership first or delete the community.' });
    }
    
    // Leave the community
    db.run(
      'DELETE FROM community_members WHERE community_id = ? AND user_id = ?',
      [communityId, userId],
      function(err) {
        if (err) {
          return res.status(500).json({ message: 'Error leaving community', error: err.message });
        }
        
        if (this.changes === 0) {
          return res.status(400).json({ message: 'Not a member of this community' });
        }
        
        res.json({ message: 'Left community successfully' });
      }
    );
  });
});

// Get community posts
router.get('/:id/posts', (req, res) => {
  const communityId = req.params.id;
  const userId = req.user.id;
  
  // Check if user is a member
  db.get(
    'SELECT * FROM community_members WHERE community_id = ? AND user_id = ?',
    [communityId, userId],
    (err, membership) => {
      if (err) {
        return res.status(500).json({ message: 'Error checking membership', error: err.message });
      }
      
      if (!membership) {
        return res.status(403).json({ message: 'You must be a member to view community posts' });
      }
      
      // Get posts
      db.all(
        `SELECT cp.*, u.username
         FROM community_posts cp
         JOIN users u ON cp.user_id = u.id
         WHERE cp.community_id = ?
         ORDER BY cp.created_at DESC`,
        [communityId],
        (err, posts) => {
          if (err) {
            return res.status(500).json({ message: 'Error fetching posts', error: err.message });
          }
          
          res.json({ posts });
        }
      );
    }
  );
});

// Create community post
router.post('/:id/posts', upload.single('image'), (req, res) => {
  const communityId = req.params.id;
  const { content } = req.body;
  const userId = req.user.id;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  
  if (!content && !imageUrl) {
    return res.status(400).json({ message: 'Post must contain content or an image' });
  }
  
  // Check if user is a member
  db.get(
    'SELECT * FROM community_members WHERE community_id = ? AND user_id = ?',
    [communityId, userId],
    (err, membership) => {
      if (err) {
        return res.status(500).json({ message: 'Error checking membership', error: err.message });
      }
      
      if (!membership) {
        return res.status(403).json({ message: 'You must be a member to post in this community' });
      }
      
      // Create post
      db.run(
        'INSERT INTO community_posts (community_id, user_id, content, image_url) VALUES (?, ?, ?, ?)',
        [communityId, userId, content, imageUrl],
        function(err) {
          if (err) {
            return res.status(500).json({ message: 'Error creating post', error: err.message });
          }
          
          // Get the created post
          db.get(
            `SELECT cp.*, u.username
             FROM community_posts cp
             JOIN users u ON cp.user_id = u.id
             WHERE cp.id = ?`,
            [this.lastID],
            (err, post) => {
              if (err) {
                return res.status(500).json({ message: 'Error fetching created post', error: err.message });
              }
              
              res.status(201).json({
                message: 'Post created successfully',
                post
              });
            }
          );
        }
      );
    }
  );
});

// Search communities
router.get('/search/:query', (req, res) => {
  const query = req.params.query;
  const userId = req.user.id;
  
  if (!query || query.length < 2) {
    return res.status(400).json({ message: 'Search query must be at least 2 characters' });
  }
  
  db.all(
    `SELECT 
      c.*,
      (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) as member_count,
      EXISTS(SELECT 1 FROM community_members WHERE community_id = c.id AND user_id = ?) as is_member
    FROM community_search
    JOIN communities c ON community_search.rowid = c.id
    WHERE community_search MATCH ?
    ORDER BY rank`,
    [userId, `${query}*`],
    (err, communities) => {
      if (err) {
        return res.status(500).json({ message: 'Error searching communities', error: err.message });
      }
      
      res.json({ communities });
    }
  );
});

module.exports = router;
