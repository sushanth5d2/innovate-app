const express = require('express');
const db = require('../db');
const router = express.Router();

// Create a reminder
router.post('/', (req, res) => {
  const { postId, reminderTime } = req.body;
  const userId = req.user.id;
  
  if (!postId || !reminderTime) {
    return res.status(400).json({ message: 'Post ID and reminder time are required' });
  }
  
  // Check if post exists
  db.get('SELECT * FROM posts p JOIN users u ON p.user_id = u.id WHERE p.id = ? AND p.is_archived = 0', 
    [postId], 
    (err, post) => {
      if (err) {
        return res.status(500).json({ message: 'Error checking post', error: err.message });
      }
      
      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }
      
      // Calculate reminder time
      const hours = parseInt(reminderTime);
      const reminderDate = new Date();
      reminderDate.setHours(reminderDate.getHours() + hours);
      
      // Store reminder in notifications table with scheduled delivery
      db.run(
        'INSERT INTO notifications (user_id, type, content, related_id, is_read, scheduled_time) VALUES (?, ?, ?, ?, ?, ?)',
        [
          userId,
          'reminder',
          `Reminder for post by ${post.username}: "${post.content.substring(0, 50)}${post.content.length > 50 ? '...' : ''}"`,
          postId,
          0,
          reminderDate.toISOString()
        ],
        function(err) {
          if (err) {
            return res.status(500).json({ message: 'Error creating reminder', error: err.message });
          }
          
          res.json({ 
            message: 'Reminder set successfully',
            reminder: {
              id: this.lastID,
              scheduledTime: reminderDate.toISOString()
            }
          });
        }
      );
    }
  );
});

// Get reminders for current user
router.get('/', (req, res) => {
  const userId = req.user.id;
  
  db.all(
    'SELECT * FROM notifications WHERE user_id = ? AND type = "reminder" ORDER BY scheduled_time ASC',
    [userId],
    (err, reminders) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching reminders', error: err.message });
      }
      
      res.json({ reminders });
    }
  );
});

// Delete a reminder
router.delete('/:id', (req, res) => {
  const reminderId = req.params.id;
  const userId = req.user.id;
  
  db.run(
    'DELETE FROM notifications WHERE id = ? AND user_id = ? AND type = "reminder"',
    [reminderId, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error deleting reminder', error: err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ message: 'Reminder not found or not authorized to delete' });
      }
      
      res.json({ message: 'Reminder deleted successfully' });
    }
  );
});

module.exports = router;
