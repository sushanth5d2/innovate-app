const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const router = express.Router();

// Configure multer for file uploads - removed file size limit
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    const uploadsDir = path.join(__dirname, '../public/uploads');
    // Ensure the uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'post-' + uniqueSuffix + ext);
  }
});

// Configure multer for file uploads with no size limits
const upload = multer({
  storage: storage,
  fileFilter: function(req, file, cb) {
    // Accept only images - no size limit
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Get all posts (feed)
router.get('/', (req, res) => {
  const userId = req.user.id;
  const filter = req.query.filter || 'all';
  
  console.log('User requesting posts:', userId);
  
  // Get user's blocked users
  db.get('SELECT blocked_users FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      console.error('Error fetching user data:', err);
      return res.status(500).json({ message: 'Error fetching user data', error: err.message });
    }
    
    const blockedUsers = JSON.parse(user.blocked_users || '[]');
    let query, params;
    
    // Improved query with user_id explicitly selected and converted to string to ensure type consistency
    const baseQuery = `
      SELECT 
        p.id, 
        p.user_id, 
        p.content, 
        p.image_url, 
        p.created_at, 
        p.updated_at, 
        u.username,
        (SELECT COUNT(*) FROM post_interactions 
         WHERE post_id = p.id AND interaction_type = 'interested') as interested_count,
        (SELECT COUNT(*) FROM post_interactions 
         WHERE post_id = p.id AND user_id = ? AND interaction_type = 'interested') as is_interested,
        CASE WHEN p.user_id = ? THEN 1 ELSE 0 END as is_owner
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.is_archived = 0
    `;
    
    // Log SQL query for debugging
    console.log('Base query:', baseQuery);
    
    if (filter === 'following') {
      // Get posts from users the current user follows
      db.get('SELECT following FROM users WHERE id = ?', [userId], (err, followingData) => {
        if (err) {
          return res.status(500).json({ message: 'Error fetching following data', error: err.message });
        }
        
        const following = JSON.parse(followingData.following || '[]');
        
        // If not following anyone, return empty array
        if (following.length === 0) {
          return res.json({ posts: [] });
        }
        
        // Create placeholders for following IDs
        const followingPlaceholders = following.map(() => '?').join(',');
        
        query = `
          ${baseQuery}
          AND p.user_id IN (${followingPlaceholders})
          ORDER BY p.created_at DESC
          LIMIT 50
        `;
        
        params = [userId, userId];
        if (blockedUsers.length > 0) {
          params = params.concat(blockedUsers);
        }
        params = params.concat(following);
        
        fetchPosts(query, params);
      });
    } else if (filter === 'trending') {
      // Get trending posts (most interested)
      query = `
        ${baseQuery}
        AND p.created_at > datetime('now', '-7 days')
        ORDER BY interested_count DESC, p.created_at DESC
        LIMIT 50
      `;
      
      params = [userId, userId];
      if (blockedUsers.length > 0) {
        params = params.concat(blockedUsers);
      }
      
      fetchPosts(query, params);
    } else {
      // Get all posts (default)
      query = `
        ${baseQuery}
        ORDER BY p.created_at DESC
        LIMIT 50
      `;
      
      params = [userId, userId];
      if (blockedUsers.length > 0) {
        params = params.concat(blockedUsers);
      }
      
      fetchPosts(query, params);
    }
    
    function fetchPosts(query, params) {
      db.all(query, params, (err, posts) => {
        if (err) {
          console.error('Database error fetching posts:', err);
          return res.status(500).json({ message: 'Error fetching posts', error: err.message });
        }
        
        // Parse poll data if it exists
        posts = posts.map(post => {
          if (post.poll_data && typeof post.poll_data === 'string') {
            try {
              post.poll_data = JSON.parse(post.poll_data);
            } catch (e) {
              post.poll_data = null;
            }
          }
          
          // Add empty poll votes/user vote for compatibility
          post.poll_votes = {};
          post.user_vote = null;
          
          return post;
        });
        
        // Log ownership info for debugging
        posts.forEach(post => {
          console.log(`Post ${post.id} - user_id: ${post.user_id}, current user: ${userId}, is_owner: ${post.is_owner}`);
        });
        
        res.json({ posts });
      });
    }
  });
});

// Create a new post
router.post('/', upload.single('image'), (req, res) => {
  try {
    const { content } = req.body;
    const userId = req.user.id;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    
    console.log('Post creation request:', { content, userId, hasImage: !!req.file });
    
    // Validate input
    if (!content && !imageUrl) {
      return res.status(400).json({ message: 'Post must have content or an image' });
    }
    
    // Insert post
    db.run(
      'INSERT INTO posts (user_id, content, image_url) VALUES (?, ?, ?)',
      [userId, content || '', imageUrl],
      function(err) {
        if (err) {
          console.error('Database error creating post:', err);
          return res.status(500).json({ message: 'Error creating post', error: err.message });
        }
        
        res.status(201).json({
          message: 'Post created successfully',
          postId: this.lastID
        });
      }
    );
  } catch (error) {
    console.error('Error in post creation endpoint:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get a specific post
router.get('/:id', (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  
  console.log(`Fetching post ${postId} for user ${userId}`);
  
  // Use improved query with explicit is_owner flag
  const query = `
    SELECT 
      p.*, 
      u.username,
      (SELECT COUNT(*) FROM post_interactions 
       WHERE post_id = p.id AND interaction_type = 'interested') as interested_count,
      (SELECT COUNT(*) FROM post_interactions 
       WHERE post_id = p.id AND user_id = ? AND interaction_type = 'interested') as is_interested,
      CASE WHEN p.user_id = ? THEN 1 ELSE 0 END as is_owner
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.id = ? AND p.is_archived = 0
  `;
  
  db.get(query, [userId, userId, postId], (err, post) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching post', error: err.message });
    }
    if (!post) {
      return res.status(404).json({ message: 'Post not found or posted by a blocked user' });
    }
    
    // Check if post is archived and if requester is not the owner
    if (post.is_archived === 1 && post.user_id !== userId) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    console.log('Post ownership:', { 
      postId: post.id, 
      postUserId: post.user_id, 
      requestUserId: userId, 
      isOwner: post.is_owner 
    });
    
    res.json({ post });
  });
});

// Update a post
router.put('/:id', upload.single('image'), (req, res) => {
  const postId = req.params.id;
  const { content } = req.body;
  const userId = req.user.id;
  
  console.log('Update post request:', {
    postId,
    userId,
    content: content || '',
    hasImage: !!req.file
  });
  
  // Verify ownership
  db.get('SELECT * FROM posts WHERE id = ?', [postId], (err, post) => {
    if (err) {
      console.error('Error fetching post:', err);
      return res.status(500).json({ message: 'Error fetching post', error: err.message });
    }
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    console.log('Post from DB:', post);
    console.log('User comparison:', {
      postUserId: post.user_id,
      requestUserId: userId, 
      isMatch: post.user_id === userId
    });
    
    if (post.user_id !== userId) {
      return res.status(403).json({ message: 'You can only edit your own posts' });
    }
    
    // Prepare update data
    let imageUrl = post.image_url;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }
    
    // Update the post
    db.run(
      'UPDATE posts SET content = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [content || '', imageUrl, postId],
      function(err) {
        if (err) {
          console.error('Error updating post:', err);
          return res.status(500).json({ message: 'Error updating post', error: err.message });
        }
        
        res.json({ message: 'Post updated successfully' });
      }
    );
  });
});

// Archive a post
router.put('/:id/archive', (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  
  console.log('Archive post request:', { postId, userId });
  
  // Verify ownership
  db.get('SELECT * FROM posts WHERE id = ?', [postId], (err, post) => {
    if (err) {
      console.error('Error fetching post:', err);
      return res.status(500).json({ message: 'Error fetching post', error: err.message });
    }
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    console.log('Post from DB:', post);
    
    // Compare as strings to avoid type issues
    if (String(post.user_id) !== String(userId)) {
      console.log('User is not post owner', { postUserId: post.user_id, currentUserId: userId });
      return res.status(403).json({ message: 'You can only archive your own posts' });
    }
    
    console.log('User confirmed as post owner, archiving post');
    
    // Archive the post
    db.run('UPDATE posts SET is_archived = 1 WHERE id = ?', [postId], function(err) {
      if (err) {
        console.error('Error archiving post:', err);
        return res.status(500).json({ message: 'Error archiving post', error: err.message });
      }
      
      console.log('Post archived successfully');
      res.json({ message: 'Post archived successfully' });
    });
  });
});

// Save a post
router.post('/:id/save', (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  
  // Check if post exists
  db.get('SELECT * FROM posts WHERE id = ? AND is_archived = 0', [postId], (err, post) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching post', error: err.message });
    }
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Save post (add to post_interactions with type 'saved')
    db.run(
      'INSERT OR REPLACE INTO post_interactions (post_id, user_id, interaction_type) VALUES (?, ?, ?)',
      [postId, userId, 'saved'],
      function(err) {
        if (err) {
          return res.status(500).json({ message: 'Error saving post', error: err.message });
        }
        
        res.json({ message: 'Post saved successfully' });
      }
    );
  });
});

// Get saved posts
router.get('/saved', (req, res) => {
  const userId = req.user.id;
  
  const query = `
    SELECT p.*, u.username, 
      (SELECT COUNT(*) FROM post_interactions 
       WHERE post_id = p.id AND interaction_type = 'interested') as interested_count,
      EXISTS(SELECT 1 FROM post_interactions 
            WHERE post_id = p.id AND user_id = ? AND interaction_type = 'interested') as is_interested
    FROM posts p
    JOIN users u ON p.user_id = u.id
    JOIN post_interactions pi ON p.id = pi.post_id
    WHERE pi.user_id = ? AND pi.interaction_type = 'saved' AND p.is_archived = 0
    ORDER BY p.created_at DESC
  `;
  
  db.all(query, [userId, userId], (err, posts) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching saved posts', error: err.message });
    }
    
    res.json({ posts });
  });
});

// Delete a post
router.delete('/:id', (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  
  console.log('Delete post request:', { postId, userId });
  
  // Verify ownership
  db.get('SELECT * FROM posts WHERE id = ?', [postId], (err, post) => {
    if (err) {
      console.error('Error fetching post:', err);
      return res.status(500).json({ message: 'Error fetching post', error: err.message });
    }
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    console.log('Post from DB:', post);
    
    // Compare as strings to avoid type issues
    if (String(post.user_id) !== String(userId)) {
      console.log('User is not post owner', { postUserId: post.user_id, currentUserId: userId });
      return res.status(403).json({ message: 'You can only delete your own posts' });
    }
    
    console.log('User confirmed as post owner, deleting post');
    
    // Delete the post
    db.run('DELETE FROM posts WHERE id = ?', [postId], function(err) {
      if (err) {
        console.error('Error deleting post:', err);
        return res.status(500).json({ message: 'Error deleting post', error: err.message });
      }
      
      // Also delete interactions
      db.run('DELETE FROM post_interactions WHERE post_id = ?', [postId]);
      
      console.log('Post deleted successfully');
      res.json({ message: 'Post deleted successfully' });
    });
  });
});

// Show interest in a post
router.post('/:id/interest', (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  
  // Check if post exists
  db.get('SELECT * FROM posts WHERE id = ? AND is_archived = 0', [postId], (err, post) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching post', error: err.message });
    }
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Check if user already showed interest
    db.get(
      'SELECT * FROM post_interactions WHERE post_id = ? AND user_id = ? AND interaction_type = "interested"',
      [postId, userId],
      (err, interaction) => {
        if (err) {
          return res.status(500).json({ message: 'Error checking interaction', error: err.message });
        }
        
        if (interaction) {
          // Remove interest
          db.run(
            'DELETE FROM post_interactions WHERE post_id = ? AND user_id = ? AND interaction_type = "interested"',
            [postId, userId],
            function(err) {
              if (err) {
                return res.status(500).json({ message: 'Error removing interest', error: err.message });
              }
              // Get updated count
              getInterestCount(postId);
            }
          );
        } else {
          // Add interest
          db.run(
            'INSERT INTO post_interactions (post_id, user_id, interaction_type) VALUES (?, ?, "interested")',
            [postId, userId],
            function(err) {
              if (err) {
                return res.status(500).json({ message: 'Error showing interest', error: err.message });
              }
              
              // Create notification for post owner (if not the current user)
              if (post.user_id !== userId) {
                db.get('SELECT username FROM users WHERE id = ?', [userId], (err, user) => {
                  if (!err && user) {
                    db.run(
                      'INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, ?, ?, ?)',
                      [
                        post.user_id,
                        'interest',
                        `${user.username} showed interest in your post`,
                        postId
                      ]
                    );
                  }
                });
              }
              // Get updated count
              getInterestCount(postId);
            }
          );
        }
      }
    );
  });
  
  // Helper to get and return the updated interest count
  function getInterestCount(postId) {
    db.get(
      'SELECT COUNT(*) as count FROM post_interactions WHERE post_id = ? AND interaction_type = "interested"',
      [postId],
      (err, result) => {
        if (err) {
          return res.status(500).json({ message: 'Error counting interests', error: err.message });
        }
        res.json({ interested_count: result.count });
      }
    );
  }
});

// Create reminder for a post
router.post('/reminders', (req, res) => {
  const { post_id, hours } = req.body;
  const userId = req.user.id;
  if (!post_id || !hours) {
    return res.status(400).json({ message: 'Post ID and hours are required' });
  }
  
  // Check if post exists
  db.get('SELECT * FROM posts WHERE id = ? AND is_archived = 0', [post_id], (err, post) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching post', error: err.message });
    }
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Calculate reminder time
    const reminderTime = new Date();
    reminderTime.setHours(reminderTime.getHours() + parseInt(hours));
    
    // In a production app, you'd use a job queue for scheduled tasks
    // For this example, we'll just store the reminder and assume a background process checks for due reminders
    db.run(
      'INSERT INTO notifications (user_id, type, content, related_id, is_read, created_at) VALUES (?, ?, ?, ?, 0, ?)',
      [
        userId,
        'reminder',
        `Reminder for post: "${post.content.substring(0, 50)}${post.content.length > 50 ? '...' : ''}"`,
        post_id,
        reminderTime.toISOString()
      ],
      function(err) {
        if (err) {
          return res.status(500).json({ message: 'Error creating reminder', error: err.message });
        }
        res.json({ message: 'Reminder set successfully' });
      }
    );
  });
});

// Vote on a poll
router.post('/:id/vote', (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const { option } = req.body;
  if (option === undefined) {
    return res.status(400).json({ message: 'Option is required' });
  }
  
  // Check if post exists and has a poll
  db.get(
    'SELECT * FROM posts WHERE id = ? AND is_archived = 0',
    [postId],
    (err, post) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching post', error: err.message });
      }
      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }
      if (!post.poll_data) {
        return res.status(400).json({ message: 'Post does not have a poll' });
      }
      
      // Parse poll data
      let pollData;
      try {
        pollData = JSON.parse(post.poll_data);
      } catch (err) {
        return res.status(500).json({ message: 'Error parsing poll data', error: err.message });
      }
      
      // Check if option is valid
      if (option < 0 || option >= pollData.options.length) {
        return res.status(400).json({ message: 'Invalid option' });
      }
      
      // Check if user has already voted
      db.get(
        'SELECT * FROM post_poll_votes WHERE post_id = ? AND user_id = ?',
        [postId, userId],
        (err, vote) => {
          if (err) {
            return res.status(500).json({ message: 'Error checking vote', error: err.message });
          }
          if (vote) {
            return res.status(400).json({ message: 'You have already voted on this poll' });
          }
          
          // Record vote
          db.run(
            'INSERT INTO post_poll_votes (post_id, user_id, option_index) VALUES (?, ?, ?)',
            [postId, userId, option],
            function(err) {
              if (err) {
                return res.status(500).json({ message: 'Error recording vote', error: err.message });
              }
              res.json({ message: 'Vote recorded successfully' });
            }
          );
        }
      );
    }
  );
});

module.exports = router;
