const express = require('express');
const db = require('../db');
const router = express.Router();

// Get all notifications for current user
router.get('/', (req, res) => {
  const userId = req.user.id;
  
  db.all(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    [userId],
    (err, notifications) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching notifications', error: err.message });
      }
      
      res.json({ notifications });
    }
  );
});

// Get unread notifications count
router.get('/unread-count', (req, res) => {
  const userId = req.user.id;
  
  db.get(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
    [userId],
    (err, result) => {
      if (err) {
        return res.status(500).json({ message: 'Error counting notifications', error: err.message });
      }
      
      res.json({ count: result.count });
    }
  );
});

// Mark a notification as read
router.put('/:id/read', (req, res) => {
  const notificationId = req.params.id;
  const userId = req.user.id;
  
  // Check if notification belongs to user
  db.get(
    'SELECT * FROM notifications WHERE id = ? AND user_id = ?',
    [notificationId, userId],
    (err, notification) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching notification', error: err.message });
      }
      
      if (!notification) {
        return res.status(404).json({ message: 'Notification not found or does not belong to you' });
      }
      
      // Mark as read
      db.run(
        'UPDATE notifications SET is_read = 1 WHERE id = ?',
        [notificationId],
        (err) => {
          if (err) {
            return res.status(500).json({ message: 'Error marking notification as read', error: err.message });
          }
          
          res.json({ message: 'Notification marked as read' });
        }
      );
    }
  );
});

// Mark all notifications as read
router.post('/mark-all-read', (req, res) => {
  const userId = req.user.id;
  
  db.run(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
    [userId],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error marking notifications as read', error: err.message });
      }
      
      res.json({ 
        message: 'All notifications marked as read',
        count: this.changes
      });
    }
  );
});

// Delete a notification
router.delete('/:id', (req, res) => {
  const notificationId = req.params.id;
  const userId = req.user.id;
  
  // Check if notification belongs to user
  db.get(
    'SELECT * FROM notifications WHERE id = ? AND user_id = ?',
    [notificationId, userId],
    (err, notification) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching notification', error: err.message });
      }
      
      if (!notification) {
        return res.status(404).json({ message: 'Notification not found or does not belong to you' });
      }
      
      // Delete notification
      db.run(
        'DELETE FROM notifications WHERE id = ?',
        [notificationId],
        (err) => {
          if (err) {
            return res.status(500).json({ message: 'Error deleting notification', error: err.message });
          }
          
          res.json({ message: 'Notification deleted successfully' });
        }
      );
    }
  );
});

// Clear all notifications
router.delete('/', (req, res) => {
  const userId = req.user.id;
  
  db.run(
    'DELETE FROM notifications WHERE user_id = ?',
    [userId],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error clearing notifications', error: err.message });
      }
      
      res.json({ 
        message: 'All notifications cleared',
        count: this.changes
      });
    }
  );
});

module.exports = router;
