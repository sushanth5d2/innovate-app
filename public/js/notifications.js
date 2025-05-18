document.addEventListener('DOMContentLoaded', function() {
  // Check if user is logged in
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  const username = localStorage.getItem('username');
  
  if (!token || !userId) {
    window.location.href = 'login.html';
    return;
  }
  
  // Update profile name in navigation
  const profileName = document.querySelector('.profile-name');
  if (profileName) {
    profileName.textContent = username;
  }
  
  // DOM elements
  const notificationsList = document.getElementById('notifications-list');
  const markAllReadBtn = document.getElementById('mark-all-read');
  const clearAllBtn = document.getElementById('clear-all');
  const notificationTemplate = document.getElementById('notification-template');
  
  // Load notifications
  loadNotifications();
  
  // Mark all as read
  markAllReadBtn.addEventListener('click', async function() {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.count > 0) {
          // Update UI to mark all as read
          document.querySelectorAll('.notification-item.unread').forEach(item => {
            item.classList.remove('unread');
          });
          
          // Show success message
          alert(`Marked ${data.count} notifications as read`);
        } else {
          alert('No unread notifications');
        }
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to mark notifications as read');
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      alert('An error occurred');
    }
  });
  
  // Clear all notifications
  clearAllBtn.addEventListener('click', async function() {
    if (!confirm('Are you sure you want to delete all notifications?')) {
      return;
    }
    
    try {
      const response = await fetch('/api/notifications', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Update UI to show empty state
        showEmptyState();
        
        // Show success message
        alert(`Cleared ${data.count} notifications`);
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to clear notifications');
      }
    } catch (error) {
      console.error('Error clearing notifications:', error);
      alert('An error occurred');
    }
  });
  
  // Load notifications from API
  async function loadNotifications() {
    try {
      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        renderNotifications(data.notifications);
      } else {
        notificationsList.innerHTML = `<p>Error loading notifications</p>`;
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      notificationsList.innerHTML = `<p>Error loading notifications</p>`;
    }
  }
  
  // Render notifications
  function renderNotifications(notifications) {
    if (!notifications || notifications.length === 0) {
      showEmptyState();
      return;
    }
    
    notificationsList.innerHTML = '';
    
    notifications.forEach(notification => {
      const notificationElement = createNotificationElement(notification);
      notificationsList.appendChild(notificationElement);
    });
  }
  
  // Create notification element
  function createNotificationElement(notification) {
    const element = document.importNode(notificationTemplate.content, true).querySelector('.notification-item');
    
    // Set classes
    if (!notification.is_read) {
      element.classList.add('unread');
    }
    
    // Set content
    element.querySelector('.notification-text').textContent = notification.content;
    element.querySelector('.notification-time').textContent = formatDate(notification.created_at);
    
    // Set icon based on type
    const iconElement = element.querySelector('.notification-icon');
    iconElement.classList.add(notification.type);
    
    switch (notification.type) {
      case 'follow':
        iconElement.innerHTML = '<i class="fas fa-user-plus"></i>';
        break;
      case 'like':
      case 'interest':
        iconElement.innerHTML = '<i class="fas fa-heart"></i>';
        break;
      case 'comment':
        iconElement.innerHTML = '<i class="fas fa-comment"></i>';
        break;
      case 'message':
      case 'new_message':
        iconElement.innerHTML = '<i class="fas fa-envelope"></i>';
        break;
      case 'event_invite':
        iconElement.innerHTML = '<i class="fas fa-calendar-plus"></i>';
        break;
      case 'community_join':
        iconElement.innerHTML = '<i class="fas fa-users"></i>';
        break;
      default:
        iconElement.innerHTML = '<i class="fas fa-bell"></i>';
    }
    
    // Set actions
    const markReadBtn = element.querySelector('.mark-read-btn');
    const deleteBtn = element.querySelector('.delete-btn');
    
    // Only show mark read button for unread notifications
    if (notification.is_read) {
      markReadBtn.classList.add('hidden');
    }
    
    // Add event listeners
    markReadBtn.addEventListener('click', async function(e) {
      e.stopPropagation();
      
      try {
        const response = await fetch(`/api/notifications/${notification.id}/read`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          // Update UI
          element.classList.remove('unread');
          markReadBtn.classList.add('hidden');
        } else {
          const errorData = await response.json();
          alert(errorData.message || 'Failed to mark as read');
        }
      } catch (error) {
        console.error('Error marking notification as read:', error);
        alert('An error occurred');
      }
    });
    
    deleteBtn.addEventListener('click', async function(e) {
      e.stopPropagation();
      
      try {
        const response = await fetch(`/api/notifications/${notification.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          // Remove notification from UI
          element.remove();
          
          // Check if any notifications remain
          if (notificationsList.children.length === 0) {
            showEmptyState();
          }
        } else {
          const errorData = await response.json();
          alert(errorData.message || 'Failed to delete notification');
        }
      } catch (error) {
        console.error('Error deleting notification:', error);
        alert('An error occurred');
      }
    });
    
    // Handle click on notification
    element.addEventListener('click', function() {
      // Mark as read if unread
      if (!notification.is_read) {
        markReadBtn.click();
      }
      
      // Navigate based on notification type
      navigateToNotificationTarget(notification);
    });
    
    return element;
  }
  
  // Navigate to notification target
  function navigateToNotificationTarget(notification) {
    switch (notification.type) {
      case 'follow':
        window.location.href = `profile.html?id=${notification.related_id}`;
        break;
      case 'like':
      case 'interest':
      case 'comment':
        window.location.href = `post.html?id=${notification.related_id}`;
        break;
      case 'message':
      case 'new_message':
        window.location.href = `messages.html?user=${notification.related_id}`;
        break;
      case 'event_invite':
        window.location.href = `events.html?id=${notification.related_id}`;
        break;
      case 'community_join':
        window.location.href = `community.html?id=${notification.related_id}`;
        break;
      default:
        // No navigation for other types
        break;
    }
  }
  
  // Show empty state
  function showEmptyState() {
    notificationsList.innerHTML = `
      <div class="empty-notifications">
        <i class="fas fa-bell-slash"></i>
        <p>No notifications to display</p>
      </div>
    `;
  }
  
  // Format date
  function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    
    if (diffSec < 60) {
      return 'Just now';
    } else if (diffMin < 60) {
      return `${diffMin}m ago`;
    } else if (diffHour < 24) {
      return `${diffHour}h ago`;
    } else if (diffDay < 7) {
      return `${diffDay}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
});
