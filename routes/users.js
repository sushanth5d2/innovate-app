const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const router = express.Router();

// Get current user profile
router.get('/me', (req, res) => {
  const userId = req.user.id;
  
  db.get('SELECT id, username, email, bio, skills, interests, following, followers, blocked_users FROM users WHERE id = ?',
    [userId],
    (err, user) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching profile', error: err.message });
      }
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Convert JSON strings to objects
      user.following = JSON.parse(user.following || '[]');
      user.followers = JSON.parse(user.followers || '[]');
      user.blocked_users = JSON.parse(user.blocked_users || '[]');
      
      // Get post count
      db.get('SELECT COUNT(*) as count FROM posts WHERE user_id = ? AND is_archived = 0',
        [userId],
        (err, result) => {
          if (err) {
            console.error('Error counting posts:', err.message);
            result = { count: 0 };
          }
          
          user.post_count = result.count;
          
          res.json({ user });
        }
      );
    }
  );
});

// Get user profile by ID
router.get('/:id', (req, res) => {
  const profileId = req.params.id;
  const viewerId = req.user.id;
  
  // Check if viewer has blocked this user or vice versa
  db.get('SELECT blocked_users FROM users WHERE id = ?', [viewerId], (err, viewer) => {
    if (err) {
      return res.status(500).json({ message: 'Error checking blocked status', error: err.message });
    }
    
    if (!viewer) {
      return res.status(404).json({ message: 'Viewer not found' });
    }
    
    const blockedUsers = JSON.parse(viewer.blocked_users || '[]');
    
    if (blockedUsers.includes(parseInt(profileId))) {
      return res.status(403).json({ message: 'You have blocked this user' });
    }
    
    db.get('SELECT blocked_users FROM users WHERE id = ?', [profileId], (err, profile) => {
      if (err) {
        return res.status(500).json({ message: 'Error checking blocked status', error: err.message });
      }
      
      if (!profile) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const profileBlockedUsers = JSON.parse(profile.blocked_users || '[]');
      
      if (profileBlockedUsers.includes(viewerId)) {
        return res.status(403).json({ message: 'This user has blocked you' });
      }
      
      // Get user profile
      db.get('SELECT id, username, bio, skills, interests, following, followers FROM users WHERE id = ?',
        [profileId],
        (err, user) => {
          if (err) {
            return res.status(500).json({ message: 'Error fetching profile', error: err.message });
          }
          
          if (!user) {
            return res.status(404).json({ message: 'User not found' });
          }
          
          // Convert JSON strings to objects
          user.following = JSON.parse(user.following || '[]');
          user.followers = JSON.parse(user.followers || '[]');
          
          // Check if viewer is following this user
          user.is_following = user.followers.includes(viewerId);
          
          // Get post count
          db.get('SELECT COUNT(*) as count FROM posts WHERE user_id = ? AND is_archived = 0',
            [profileId],
            (err, result) => {
              if (err) {
                console.error('Error counting posts:', err.message);
                result = { count: 0 };
              }
              
              user.post_count = result.count;
              
              res.json({ user });
            }
          );
        }
      );
    });
  });
});

// Update user profile
router.put('/update-profile', (req, res) => {
  const userId = req.user.id;
  const { bio, skills, interests } = req.body;
  
  db.run('UPDATE users SET bio = ?, skills = ?, interests = ? WHERE id = ?',
    [bio || '', skills || '', interests || '', userId],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error updating profile', error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json({ message: 'Profile updated successfully' });
    }
  );
});

// Change password
router.put('/change-password', (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;
  
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Current password and new password are required' });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'New password must be at least 6 characters long' });
  }
  
  // Get user's current password hash
  db.get('SELECT password FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching user', error: err.message });
    }
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify current password
    bcrypt.compare(currentPassword, user.password, (err, match) => {
      if (err) {
        return res.status(500).json({ message: 'Error verifying password', error: err.message });
      }
      
      if (!match) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
      
      // Hash new password
      bcrypt.hash(newPassword, 10, (err, hash) => {
        if (err) {
          return res.status(500).json({ message: 'Error hashing password', error: err.message });
        }
        
        // Update password
        db.run('UPDATE users SET password = ? WHERE id = ?', [hash, userId], function(err) {
          if (err) {
            return res.status(500).json({ message: 'Error updating password', error: err.message });
          }
          
          res.json({ message: 'Password changed successfully' });
        });
      });
    });
  });
});

// Get user posts - Improve error handling and fix column selection
router.get('/:id/posts', (req, res) => {
  const profileId = req.params.id;
  const viewerId = req.user.id;
  
  console.log(`Fetching posts for user ID: ${profileId}, requested by user ID: ${viewerId}`);
  
  // Simplified query to ensure it works correctly
  const query = `
    SELECT 
      p.id, p.user_id, p.content, p.image_url, p.created_at, p.updated_at,
      u.username,
      (SELECT COUNT(*) FROM post_interactions 
       WHERE post_id = p.id AND interaction_type = 'interested') as interested_count,
      (SELECT COUNT(*) FROM post_interactions 
       WHERE post_id = p.id AND user_id = ? AND interaction_type = 'interested') as is_interested
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.user_id = ? AND p.is_archived = 0
    ORDER BY p.created_at DESC
  `;
  
  // Debug: Print the executed query with params
  console.log('Executing query:', query.replace(/\s+/g, ' ').trim());
  console.log('With params:', [viewerId, profileId]);
  
  db.all(query, [viewerId, profileId], (err, posts) => {
    if (err) {
      console.error('Error fetching user posts:', err);
      return res.status(500).json({ message: 'Error fetching posts', error: err.message });
    }
    
    console.log(`Found ${posts.length} posts for user ${profileId}`);
    
    // Debug: Print the first post if available
    if (posts.length > 0) {
      console.log('First post sample:', {
        id: posts[0].id,
        content: posts[0].content && posts[0].content.substring(0, 30) + '...',
        username: posts[0].username
      });
    }
    
    res.json({ posts });
  });
});

// Get user following
router.get('/:id/following', (req, res) => {
  const profileId = req.params.id;
  const viewerId = req.user.id;
  
  // Get the user's following IDs
  db.get('SELECT following FROM users WHERE id = ?', [profileId], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching following', error: err.message });
    }
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const following = JSON.parse(user.following || '[]');
    
    if (following.length === 0) {
      return res.json({ users: [] });
    }
    
    // Get viewer's following to check if viewer follows these users
    db.get('SELECT following FROM users WHERE id = ?', [viewerId], (err, viewer) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching viewer following', error: err.message });
      }
      
      const viewerFollowing = JSON.parse((viewer?.following) || '[]');
      
      // Convert following array to placeholders for SQL query
      const placeholders = following.map(() => '?').join(',');
      
      // Get details for each followed user
      db.all(
        `SELECT id, username, bio FROM users WHERE id IN (${placeholders})`,
        following,
        (err, users) => {
          if (err) {
            return res.status(500).json({ message: 'Error fetching following details', error: err.message });
          }
          
          // Add is_following flag
          users = users.map(user => ({
            ...user,
            is_following: viewerFollowing.includes(user.id)
          }));
          
          res.json({ users });
        }
      );
    });
  });
});

// Get user followers
router.get('/:id/followers', (req, res) => {
  const profileId = req.params.id;
  const viewerId = req.user.id;
  
  // Get the user's followers IDs
  db.get('SELECT followers FROM users WHERE id = ?', [profileId], (err, user) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching followers', error: err.message });
    }
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const followers = JSON.parse(user.followers || '[]');
    
    if (followers.length === 0) {
      return res.json({ users: [] });
    }
    
    // Get viewer's following to check if viewer follows these users
    db.get('SELECT following FROM users WHERE id = ?', [viewerId], (err, viewer) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching viewer following', error: err.message });
      }
      
      const viewerFollowing = JSON.parse((viewer?.following) || '[]');
      
      // Convert followers array to placeholders for SQL query
      const placeholders = followers.map(() => '?').join(',');
      
      // Get details for each follower
      db.all(
        `SELECT id, username, bio FROM users WHERE id IN (${placeholders})`,
        followers,
        (err, users) => {
          if (err) {
            return res.status(500).json({ message: 'Error fetching followers details', error: err.message });
          }
          
          // Add is_following flag
          users = users.map(user => ({
            ...user,
            is_following: viewerFollowing.includes(user.id)
          }));
          
          res.json({ users });
        }
      );
    });
  });
});

// Follow a user
router.post('/:id/follow', (req, res) => {
  const userToFollowId = parseInt(req.params.id);
  const followerId = req.user.id;
  
  if (userToFollowId === followerId) {
    return res.status(400).json({ message: 'You cannot follow yourself' });
  }
  
  // Get the user to follow
  db.get('SELECT * FROM users WHERE id = ?', [userToFollowId], (err, userToFollow) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching user', error: err.message });
    }
    
    if (!userToFollow) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get follower
    db.get('SELECT following FROM users WHERE id = ?', [followerId], (err, follower) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching follower', error: err.message });
      }
      
      // Update follower's following list
      const following = JSON.parse(follower.following || '[]');
      
      if (following.includes(userToFollowId)) {
        return res.status(400).json({ message: 'Already following this user' });
      }
      
      following.push(userToFollowId);
      
      db.run('UPDATE users SET following = ? WHERE id = ?',
        [JSON.stringify(following), followerId],
        (err) => {
          if (err) {
            return res.status(500).json({ message: 'Error updating following list', error: err.message });
          }
          
          // Update followed user's followers list
          db.get('SELECT followers FROM users WHERE id = ?', [userToFollowId], (err, followed) => {
            if (err) {
              return res.status(500).json({ message: 'Error fetching followed user', error: err.message });
            }
            
            const followers = JSON.parse(followed.followers || '[]');
            followers.push(followerId);
            
            db.run('UPDATE users SET followers = ? WHERE id = ?',
              [JSON.stringify(followers), userToFollowId],
              (err) => {
                if (err) {
                  return res.status(500).json({ message: 'Error updating followers list', error: err.message });
                }
                
                // Create notification
                db.get('SELECT username FROM users WHERE id = ?', [followerId], (err, user) => {
                  if (!err && user) {
                    db.run(
                      'INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, ?, ?, ?)',
                      [
                        userToFollowId,
                        'follow',
                        `${user.username} started following you`,
                        followerId
                      ]
                    );
                  }
                });
                
                res.json({ message: 'Successfully followed user' });
              }
            );
          });
        }
      );
    });
  });
});

// Unfollow a user
router.post('/:id/unfollow', (req, res) => {
  const userToUnfollowId = parseInt(req.params.id);
  const followerId = req.user.id;
  
  if (userToUnfollowId === followerId) {
    return res.status(400).json({ message: 'You cannot unfollow yourself' });
  }
  
  // Get follower
  db.get('SELECT following FROM users WHERE id = ?', [followerId], (err, follower) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching follower', error: err.message });
    }
    
    // Update follower's following list
    const following = JSON.parse(follower.following || '[]');
    
    if (!following.includes(userToUnfollowId)) {
      return res.status(400).json({ message: 'Not following this user' });
    }
    
    const updatedFollowing = following.filter(id => id !== userToUnfollowId);
    
    db.run('UPDATE users SET following = ? WHERE id = ?',
      [JSON.stringify(updatedFollowing), followerId],
      (err) => {
        if (err) {
          return res.status(500).json({ message: 'Error updating following list', error: err.message });
        }
        
        // Update unfollowed user's followers list
        db.get('SELECT followers FROM users WHERE id = ?', [userToUnfollowId], (err, followed) => {
          if (err) {
            return res.status(500).json({ message: 'Error fetching unfollowed user', error: err.message });
          }
          
          const followers = JSON.parse(followed.followers || '[]');
          const updatedFollowers = followers.filter(id => id !== followerId);
          
          db.run('UPDATE users SET followers = ? WHERE id = ?',
            [JSON.stringify(updatedFollowers), userToUnfollowId],
            (err) => {
              if (err) {
                return res.status(500).json({ message: 'Error updating followers list', error: err.message });
              }
              
              res.json({ message: 'Successfully unfollowed user' });
            }
          );
        });
      }
    );
  });
});

// Block a user
router.post('/:id/block', (req, res) => {
  const userToBlockId = parseInt(req.params.id);
  const blockerId = req.user.id;
  
  if (userToBlockId === blockerId) {
    return res.status(400).json({ message: 'You cannot block yourself' });
  }
  
  // Get the user to block
  db.get('SELECT * FROM users WHERE id = ?', [userToBlockId], (err, userToBlock) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching user', error: err.message });
    }
    
    if (!userToBlock) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Get blocker
    db.get('SELECT blocked_users, following, followers FROM users WHERE id = ?', [blockerId], (err, blocker) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching blocker', error: err.message });
      }
      
      // Update blocker's blocked users list
      const blockedUsers = JSON.parse(blocker.blocked_users || '[]');
      
      if (blockedUsers.includes(userToBlockId)) {
        return res.status(400).json({ message: 'User is already blocked' });
      }
      
      blockedUsers.push(userToBlockId);
      
      // Also remove from following and followers if present
      const following = JSON.parse(blocker.following || '[]');
      const followers = JSON.parse(blocker.followers || '[]');
      
      const updatedFollowing = following.filter(id => id !== userToBlockId);
      const updatedFollowers = followers.filter(id => id !== userToBlockId);
      
      db.run('UPDATE users SET blocked_users = ?, following = ?, followers = ? WHERE id = ?',
        [JSON.stringify(blockedUsers), JSON.stringify(updatedFollowing), JSON.stringify(updatedFollowers), blockerId],
        (err) => {
          if (err) {
            return res.status(500).json({ message: 'Error updating blocked users list', error: err.message });
          }
          
          // Also remove blocker from blocked user's following/followers lists
          db.get('SELECT following, followers FROM users WHERE id = ?', [userToBlockId], (err, blocked) => {
            if (err) {
              return res.status(500).json({ message: 'Error fetching blocked user', error: err.message });
            }
            
            const blockedFollowing = JSON.parse(blocked.following || '[]');
            const blockedFollowers = JSON.parse(blocked.followers || '[]');
            
            const updatedBlockedFollowing = blockedFollowing.filter(id => id !== blockerId);
            const updatedBlockedFollowers = blockedFollowers.filter(id => id !== blockerId);
            
            db.run('UPDATE users SET following = ?, followers = ? WHERE id = ?',
              [JSON.stringify(updatedBlockedFollowing), JSON.stringify(updatedBlockedFollowers), userToBlockId],
              (err) => {
                if (err) {
                  return res.status(500).json({ message: 'Error updating blocked user lists', error: err.message });
                }
                
                res.json({ message: 'User blocked successfully' });
              }
            );
          });
        }
      );
    });
  });
});

// Unblock a user
router.post('/:id/unblock', (req, res) => {
  const userToUnblockId = parseInt(req.params.id);
  const blockerId = req.user.id;
  
  // Get blocker
  db.get('SELECT blocked_users FROM users WHERE id = ?', [blockerId], (err, blocker) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching blocker', error: err.message });
    }
    
    // Update blocker's blocked users list
    const blockedUsers = JSON.parse(blocker.blocked_users || '[]');
    
    if (!blockedUsers.includes(userToUnblockId)) {
      return res.status(400).json({ message: 'User is not blocked' });
    }
    
    const updatedBlockedUsers = blockedUsers.filter(id => id !== userToUnblockId);
    
    db.run('UPDATE users SET blocked_users = ? WHERE id = ?',
      [JSON.stringify(updatedBlockedUsers), blockerId],
      (err) => {
        if (err) {
          return res.status(500).json({ message: 'Error updating blocked users list', error: err.message });
        }
        
        res.json({ message: 'User unblocked successfully' });
      }
    );
  });
});

module.exports = router;
