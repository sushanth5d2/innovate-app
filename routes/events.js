const express = require('express');
const db = require('../db');
const router = express.Router();

// Get all events for current user
router.get('/', (req, res) => {
  const userId = req.user.id;
  
  // Get events where user is creator or attendee
  const query = `
    SELECT 
      e.*,
      u.username as creator_name,
      ea.status
    FROM events e
    JOIN users u ON e.creator_id = u.id
    LEFT JOIN event_attendees ea ON e.id = ea.event_id AND ea.user_id = ?
    WHERE e.creator_id = ? 
    OR e.id IN (
      SELECT event_id FROM event_attendees WHERE user_id = ?
    )
    ORDER BY e.date ASC
  `;
  
  db.all(query, [userId, userId, userId], (err, events) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching events', error: err.message });
    }
    
    res.json({ events });
  });
});

// Create a new event
router.post('/', (req, res) => {
  const { title, date, description, attendees } = req.body;
  const creatorId = req.user.id;
  
  if (!title || !date) {
    return res.status(400).json({ message: 'Title and date are required' });
  }
  
  // Insert the event
  db.run(
    'INSERT INTO events (title, description, date, creator_id) VALUES (?, ?, ?, ?)',
    [title, description || '', date, creatorId],
    function(err) {
      if (err) {
        return res.status(500).json({ message: 'Error creating event', error: err.message });
      }
      
      const eventId = this.lastID;
      
      // Add attendees if provided
      if (attendees && attendees.length > 0) {
        const attendeeValues = attendees.map(attendeeId => 
          `(${eventId}, ${attendeeId}, 'pending')`
        ).join(', ');
        
        const attendeesQuery = `
          INSERT INTO event_attendees (event_id, user_id, status)
          VALUES ${attendeeValues}
        `;
        
        db.run(attendeesQuery, function(err) {
          if (err) {
            console.error('Error adding attendees:', err.message);
          }
          
          // Create notifications for attendees
          db.get('SELECT username FROM users WHERE id = ?', [creatorId], (err, creator) => {
            if (!err && creator) {
              attendees.forEach(attendeeId => {
                db.run(
                  'INSERT INTO notifications (user_id, type, content, related_id) VALUES (?, ?, ?, ?)',
                  [
                    attendeeId,
                    'event_invite',
                    `${creator.username} invited you to "${title}"`,
                    eventId
                  ]
                );
              });
            }
          });
        });
      }
      
      res.status(201).json({
        message: 'Event created successfully',
        eventId
      });
    }
  );
});

// Get a specific event
router.get('/:id', (req, res) => {
  const eventId = req.params.id;
  const userId = req.user.id;
  
  const query = `
    SELECT 
      e.*,
      u.username as creator_name,
      ea.status
    FROM events e
    JOIN users u ON e.creator_id = u.id
    LEFT JOIN event_attendees ea ON e.id = ea.event_id AND ea.user_id = ?
    WHERE e.id = ?
  `;
  
  db.get(query, [userId, eventId], (err, event) => {
    if (err) {
      return res.status(500).json({ message: 'Error fetching event', error: err.message });
    }
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    res.json({ event });
  });
});

// Get attendees for an event
router.get('/:id/attendees', (req, res) => {
  const eventId = req.params.id;
  const userId = req.user.id;
  
  // Check if user is creator or attendee
  db.get(
    'SELECT * FROM events WHERE id = ? AND creator_id = ?',
    [eventId, userId],
    (err, event) => {
      if (err) {
        return res.status(500).json({ message: 'Error checking event', error: err.message });
      }
      
      if (!event) {
        db.get(
          'SELECT * FROM event_attendees WHERE event_id = ? AND user_id = ?',
          [eventId, userId],
          (err, attendee) => {
            if (err) {
              return res.status(500).json({ message: 'Error checking attendance', error: err.message });
            }
            
            if (!attendee) {
              return res.status(403).json({ message: 'You do not have permission to view this event' });
            }
            
            getAttendees();
          }
        );
      } else {
        getAttendees();
      }
    }
  );
  
  function getAttendees() {
    const query = `
      SELECT 
        ea.user_id,
        ea.status,
        u.username
      FROM event_attendees ea
      JOIN users u ON ea.user_id = u.id
      WHERE ea.event_id = ?
    `;
    
    db.all(query, [eventId], (err, attendees) => {
      if (err) {
        return res.status(500).json({ message: 'Error fetching attendees', error: err.message });
      }
      
      res.json({ attendees });
    });
  }
});

// Update attendee status
router.put('/:id/status', (req, res) => {
  const eventId = req.params.id;
  const userId = req.user.id;
  const { status } = req.body;
  
  if (!status || !['going', 'not-going'].includes(status)) {
    return res.status(400).json({ message: 'Valid status required: "going" or "not-going"' });
  }
  
  // Check if user is an attendee
  db.get(
    'SELECT * FROM event_attendees WHERE event_id = ? AND user_id = ?',
    [eventId, userId],
    (err, attendee) => {
      if (err) {
        return res.status(500).json({ message: 'Error checking attendance', error: err.message });
      }
      
      if (!attendee) {
        // Add user as attendee if not already one
        db.run(
          'INSERT INTO event_attendees (event_id, user_id, status) VALUES (?, ?, ?)',
          [eventId, userId, status],
          function(err) {
            if (err) {
              return res.status(500).json({ message: 'Error updating status', error: err.message });
            }
            
            res.json({ message: 'Status updated successfully' });
          }
        );
      } else {
        // Update existing status
        db.run(
          'UPDATE event_attendees SET status = ? WHERE event_id = ? AND user_id = ?',
          [status, eventId, userId],
          function(err) {
            if (err) {
              return res.status(500).json({ message: 'Error updating status', error: err.message });
            }
            
            if (this.changes === 0) {
              return res.status(404).json({ message: 'Attendance record not found' });
            }
            
            res.json({ message: 'Status updated successfully' });
          }
        );
      }
    }
  );
});

// Update an event
router.put('/:id', (req, res) => {
  const eventId = req.params.id;
  const userId = req.user.id;
  const { title, date, description } = req.body;
  
  if (!title || !date) {
    return res.status(400).json({ message: 'Title and date are required' });
  }
  
  // Check if user is the creator
  db.get(
    'SELECT * FROM events WHERE id = ?',
    [eventId],
    (err, event) => {
      if (err) {
        return res.status(500).json({ message: 'Error checking event', error: err.message });
      }
      
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      if (event.creator_id !== userId) {
        return res.status(403).json({ message: 'Only the event creator can update the event' });
      }
      
      // Update the event
      db.run(
        'UPDATE events SET title = ?, description = ?, date = ? WHERE id = ?',
        [title, description || '', date, eventId],
        function(err) {
          if (err) {
            return res.status(500).json({ message: 'Error updating event', error: err.message });
          }
          
          if (this.changes === 0) {
            return res.status(404).json({ message: 'Event not found' });
          }
          
          res.json({ message: 'Event updated successfully' });
        }
      );
    }
  );
});

// Delete (cancel) an event
router.delete('/:id', (req, res) => {
  const eventId = req.params.id;
  const userId = req.user.id;
  
  // Check if user is the creator
  db.get(
    'SELECT * FROM events WHERE id = ?',
    [eventId],
    (err, event) => {
      if (err) {
        return res.status(500).json({ message: 'Error checking event', error: err.message });
      }
      
      if (!event) {
        return res.status(404).json({ message: 'Event not found' });
      }
      
      if (event.creator_id !== userId) {
        return res.status(403).json({ message: 'Only the event creator can cancel the event' });
      }
      
      // Delete the event
      db.run('DELETE FROM events WHERE id = ?', [eventId], function(err) {
        if (err) {
          return res.status(500).json({ message: 'Error deleting event', error: err.message });
        }
        
        // Delete attendees
        db.run('DELETE FROM event_attendees WHERE event_id = ?', [eventId], function(err) {
          if (err) {
            console.error('Error deleting event attendees:', err.message);
          }
        });
        
        res.json({ message: 'Event cancelled successfully' });
      });
    }
  );
});

module.exports = router;
