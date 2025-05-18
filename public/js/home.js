document.addEventListener('DOMContentLoaded', function() {
  // Check if user is logged in
  const token = localStorage.getItem('token');
  const userId = localStorage.getItem('userId');
  const username = localStorage.getItem('username');
  
  if (!token || !userId) {
    window.location.href = 'login.html';
    return;
  }
  
  // DOM Elements
  const createPostForm = document.getElementById('create-post-form');
  const postContentInput = document.getElementById('post-content');
  const postImageInput = document.getElementById('post-image');
  const imagePreview = document.getElementById('image-preview');
  const previewImage = document.getElementById('preview-image');
  const removeImageBtn = document.getElementById('remove-image');
  const postsContainer = document.getElementById('posts-container');
  const filterButtons = document.querySelectorAll('.filter-btn');
  const postTemplate = document.getElementById('post-template');
  const postOwnerMenuTemplate = document.getElementById('post-owner-menu-template');
  const postViewerMenuTemplate = document.getElementById('post-viewer-menu-template');
  
  // Modals
  const editPostModal = document.getElementById('edit-post-modal');
  const editPostForm = document.getElementById('edit-post-form');
  const editPostIdInput = document.getElementById('edit-post-id');
  const editPostContentInput = document.getElementById('edit-post-content');
  const editPostImageInput = document.getElementById('edit-post-image');
  const editImagePreview = document.getElementById('edit-image-preview');
  const editPreviewImage = document.getElementById('edit-preview-image');
  const editRemoveImageBtn = document.getElementById('edit-remove-image');
  const closeModalButtons = document.querySelectorAll('.close-modal, .cancel-modal');
  
  const reminderModal = document.getElementById('reminder-modal');
  const reminderForm = document.getElementById('reminder-form');
  const reminderPostIdInput = document.getElementById('reminder-post-id');
  
  const meetingModal = document.getElementById('meeting-modal');
  const meetingForm = document.getElementById('meeting-form');
  const meetingPostIdInput = document.getElementById('meeting-post-id');
  const meetingWithUserInput = document.getElementById('meeting-with-user');
  const meetingTitleInput = document.getElementById('meeting-title');
  const meetingTimeInput = document.getElementById('meeting-time');
  
  // Variables
  let currentFilter = 'all';
  let posts = [];
  let currentFile = null;
  let editFile = null;
  
  // Initialize
  loadPosts(currentFilter);
  
  // Filter buttons
  filterButtons.forEach(button => {
    button.addEventListener('click', function() {
      filterButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      currentFilter = this.getAttribute('data-filter');
      loadPosts(currentFilter);
    });
  });
  
  // Handle image upload preview
  postImageInput.addEventListener('change', function(e) {
    handleImageUpload(e, previewImage, imagePreview, file => {
      currentFile = file;
    });
  });
  
  // Remove image from preview
  removeImageBtn.addEventListener('click', function() {
    removeImage(imagePreview, () => {
      currentFile = null;
      postImageInput.value = '';
    });
  });
  
  // Handle edit image upload preview
  editPostImageInput.addEventListener('change', function(e) {
    handleImageUpload(e, editPreviewImage, editImagePreview, file => {
      editFile = file;
    });
  });
  
  // Remove image from edit preview
  editRemoveImageBtn.addEventListener('click', function() {
    removeImage(editImagePreview, () => {
      editFile = null;
      editPostImageInput.value = '';
    });
  });
  
  // Close modals
  closeModalButtons.forEach(button => {
    button.addEventListener('click', function() {
      editPostModal.classList.add('hidden');
      reminderModal.classList.add('hidden');
      meetingModal.classList.add('hidden');
    });
  });
  
  // Close modals when clicking outside
  window.addEventListener('click', function(e) {
    if (e.target === editPostModal) {
      editPostModal.classList.add('hidden');
    }
    if (e.target === reminderModal) {
      reminderModal.classList.add('hidden');
    }
    if (e.target === meetingModal) {
      meetingModal.classList.add('hidden');
    }
  });
  
  // Create post form submission
  createPostForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const content = postContentInput.value.trim();
    
    if (!content && !currentFile) {
      alert('Please enter content or upload an image');
      return;
    }
    
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('content', content);
      
      if (currentFile) {
        formData.append('image', currentFile);
      }
      
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Reset form
        postContentInput.value = '';
        postImageInput.value = '';
        currentFile = null;
        imagePreview.classList.add('hidden');
        
        // Reload posts to show new post
        loadPosts(currentFilter);
      } else {
        alert(data.message || 'Error creating post');
      }
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Error creating post');
    }
  });
  
  // Edit post form submission
  editPostForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const postId = editPostIdInput.value;
    const content = editPostContentInput.value.trim();
    
    if (!content && !editFile) {
      alert('Please enter content or upload an image');
      return;
    }
    
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('content', content);
      
      if (editFile) {
        formData.append('image', editFile);
      }
      
      const response = await fetch(`/api/posts/${postId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Close modal
        editPostModal.classList.add('hidden');
        
        // Reload posts to show updated post
        loadPosts(currentFilter);
      } else {
        alert(data.message || 'Error updating post');
      }
    } catch (error) {
      console.error('Error updating post:', error);
      alert('Error updating post');
    }
  });
  
  // Reminder form submission
  reminderForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const postId = reminderPostIdInput.value;
    const reminderTime = document.getElementById('reminder-time').value;
    
    try {
      const response = await fetch('/api/reminders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          postId,
          reminderTime
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Close modal
        reminderModal.classList.add('hidden');
        alert('Reminder set successfully!');
      } else {
        alert(data.message || 'Error setting reminder');
      }
    } catch (error) {
      console.error('Error setting reminder:', error);
      alert('Error setting reminder');
    }
  });
  
  // Meeting form submission
  meetingForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const postId = meetingPostIdInput.value;
    const withUserId = meetingWithUserInput.value;
    const title = meetingTitleInput.value;
    const meetingTime = meetingTimeInput.value;
    
    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title,
          date: meetingTime,
          description: `Meeting regarding post #${postId}`,
          attendees: [withUserId]
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Close modal
        meetingModal.classList.add('hidden');
        alert('Meeting scheduled successfully!');
      } else {
        alert(data.message || 'Error scheduling meeting');
      }
    } catch (error) {
      console.error('Error scheduling meeting:', error);
      alert('Error scheduling meeting');
    }
  });
  
  // Load Posts
  async function loadPosts(filter) {
    try {
      postsContainer.innerHTML = `
        <div class="loading-indicator">
          <i class="fas fa-spinner fa-spin"></i> Loading posts...
        </div>
      `;
      
      let endpoint = '/api/posts';
      
      if (filter === 'following') {
        endpoint += '?filter=following';
      } else if (filter === 'trending') {
        endpoint += '?filter=trending';
      }
      
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        posts = data.posts || [];
        
        if (posts.length === 0) {
          postsContainer.innerHTML = `
            <div class="no-posts">
              <p>No posts to display.</p>
            </div>
          `;
          return;
        }
        
        renderPosts(posts);
      } else {
        postsContainer.innerHTML = `
          <div class="error-message">
            <p>${data.message || 'Error loading posts'}</p>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error loading posts:', error);
      postsContainer.innerHTML = `
        <div class="error-message">
          <p>Error loading posts</p>
        </div>
      `;
    }
  }
  
  // Render Posts
  function renderPosts(posts) {
    postsContainer.innerHTML = '';
    
    posts.forEach(post => {
      const postElement = createPostElement(post);
      postsContainer.appendChild(postElement);
    });
  }
  
  // Create Post Element
  function createPostElement(post) {
    console.log("Creating post element with data:", post);
    
    // Create container
    const postElement = document.createElement('div');
    postElement.className = 'post';
    postElement.setAttribute('data-post-id', post.id);
    postElement.setAttribute('data-user-id', post.user_id);
    
    // Convert to string for reliable comparison
    const postUserId = String(post.user_id);
    const currentUserId = String(userId);
    
    // Check if user is the owner - using multiple checks for reliability
    const isOwner = post.is_owner === 1 || postUserId === currentUserId;
    
    console.log(`Post ${post.id} ownership check:`, {
      postUserId: postUserId,
      currentUserId: currentUserId,
      is_owner_flag: post.is_owner,
      isOwnerByComparison: postUserId === currentUserId,
      finalOwnerStatus: isOwner
    });
    
    // Build the post HTML
    postElement.innerHTML = `
      <div class="post-header">
        <div class="post-author">
          <div class="author-avatar">
            <i class="fas fa-user-circle"></i>
          </div>
          <div class="author-info">
            <h4 class="author-name">${post.username}</h4>
            <span class="post-time">${formatDate(post.created_at)}</span>
          </div>
        </div>
        <div class="post-options">
          <button class="post-menu-btn">
            <i class="fas fa-ellipsis-h"></i>
          </button>
          <div class="post-menu-dropdown hidden">
            ${isOwner ? `
              <!-- Owner Menu -->
              <div class="menu-item edit-option">
                <i class="fas fa-edit"></i> Edit Post
              </div>
              <div class="menu-item archive-option">
                <i class="fas fa-archive"></i> Archive Post
              </div>
              <div class="menu-item delete-option">
                <i class="fas fa-trash"></i> Delete Post
              </div>
            ` : `
              <!-- Viewer Menu -->
              <div class="menu-item reminder-option">
                <i class="fas fa-bell"></i> Gentle Reminder
              </div>
              <div class="menu-item meeting-option">
                <i class="fas fa-calendar"></i> Instant Meeting
              </div>
              <div class="menu-item save-option">
                <i class="fas fa-bookmark"></i> Save Post
              </div>
            `}
          </div>
        </div>
      </div>
      <div class="post-content">
        <p class="post-text">${post.content}</p>
        ${post.image_url ? `
          <div class="post-image-container">
            <img src="${post.image_url}" alt="Post image">
          </div>
        ` : '<div class="post-image-container"></div>'}
      </div>
      <div class="post-actions">
        <button class="btn-interest ${post.is_interested ? 'active' : ''}">
          <i class="fas fa-star"></i> I'm Interested
        </button>
        <button class="btn-contact">
          <i class="fas fa-comment"></i> Contact Me
        </button>
        <button class="btn-share">
          <i class="fas fa-share"></i> Share
        </button>
      </div>
      <div class="post-stats">
        <span class="interested-count">${post.interested_count || 0} interested</span>
      </div>
    `;
  
    // Setup event listeners
    setupPostEventListeners(postElement, post, isOwner);
    
    return postElement;
  }
  
  // Revised event listener setup with better error handling
  function setupPostEventListeners(postElement, post, isOwner) {
    const postId = post.id;
    
    // Menu toggle
    const menuBtn = postElement.querySelector('.post-menu-btn');
    const menuDropdown = postElement.querySelector('.post-menu-dropdown');
    
    menuBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      menuDropdown.classList.toggle('hidden');
      console.log(`Menu toggled for post ${postId}, isOwner: ${isOwner}`);
      
      // Close other open menus
      document.querySelectorAll('.post-menu-dropdown:not(.hidden)').forEach(dropdown => {
        if (dropdown !== menuDropdown) {
          dropdown.classList.add('hidden');
        }
      });
    });
    
    // Interest button
    const interestBtn = postElement.querySelector('.btn-interest');
    if (interestBtn) {
      interestBtn.addEventListener('click', async function() {
        try {
          const response = await fetch(`/api/posts/${postId}/interest`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            this.classList.toggle('active');
            postElement.querySelector('.interested-count').textContent = 
              `${data.interested_count} interested`;
          }
        } catch (error) {
          console.error('Error showing interest:', error);
        }
      });
    }
    
    // Contact button
    const contactBtn = postElement.querySelector('.btn-contact');
    if (contactBtn) {
      contactBtn.addEventListener('click', function() {
        window.location.href = `messages.html?user=${post.user_id}`;
      });
    }
    
    // Share button
    const shareBtn = postElement.querySelector('.btn-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', function() {
        const postUrl = `${window.location.origin}/post.html?id=${postId}`;
        copyToClipboard(postUrl);
        alert('Link copied to clipboard!');
      });
    }
    
    // Owner-specific actions
    if (isOwner) {
      console.log(`Setting up owner actions for post ${postId}`);
      
      // Edit action
      const editOption = postElement.querySelector('.edit-option');
      if (editOption) {
        editOption.addEventListener('click', function() {
          console.log(`Edit clicked for post ${postId}`);
          menuDropdown.classList.add('hidden');
          alert(`Edit functionality for post ${postId} coming soon!`);
        });
      }
      
      // Archive action
      const archiveOption = postElement.querySelector('.archive-option');
      if (archiveOption) {
        archiveOption.addEventListener('click', async function() {
          console.log(`Archive clicked for post ${postId}`);
          menuDropdown.classList.add('hidden');
          
          if (confirm('Are you sure you want to archive this post?')) {
            try {
              const response = await fetch(`/api/posts/${postId}/archive`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              
              if (response.ok) {
                postElement.remove();
                alert('Post archived successfully!');
              } else {
                const data = await response.json();
                alert(data.message || 'Error archiving post');
              }
            } catch (error) {
              console.error('Error archiving post:', error);
              alert('Error archiving post: ' + error.message);
            }
          }
        });
      }
      
      // Delete action
      const deleteOption = postElement.querySelector('.delete-option');
      if (deleteOption) {
        deleteOption.addEventListener('click', async function() {
          console.log(`Delete clicked for post ${postId}`);
          menuDropdown.classList.add('hidden');
          
          if (confirm('Are you sure you want to delete this post? This cannot be undone.')) {
            try {
              const response = await fetch(`/api/posts/${postId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              
              if (response.ok) {
                postElement.remove();
                alert('Post deleted successfully!');
              } else {
                const data = await response.json();
                alert(data.message || 'Error deleting post');
              }
            } catch (error) {
              console.error('Error deleting post:', error);
              alert('Error deleting post: ' + error.message);
            }
          }
        });
      }
    } 
    // Viewer-specific actions
    else {
      console.log(`Setting up viewer actions for post ${postId}`);
      
      // Reminder action
      const reminderOption = postElement.querySelector('.reminder-option');
      if (reminderOption) {
        reminderOption.addEventListener('click', function() {
          menuDropdown.classList.add('hidden');
          alert('Reminder functionality coming soon!');
        });
      }
      
      // Meeting action
      const meetingOption = postElement.querySelector('.meeting-option');
      if (meetingOption) {
        meetingOption.addEventListener('click', function() {
          menuDropdown.classList.add('hidden');
          alert('Meeting functionality coming soon!');
        });
      }
      
      // Save action
      const saveOption = postElement.querySelector('.save-option');
      if (saveOption) {
        saveOption.addEventListener('click', function() {
          menuDropdown.classList.add('hidden');
          alert('Save functionality coming soon!');
        });
      }
    }
  }
  
  // Open edit modal
  function openEditModal(post) {
    console.log('Opening edit modal for post:', post);
    
    const editPostModal = document.getElementById('edit-post-modal');
    const editPostForm = document.getElementById('edit-post-form');
    const editPostIdInput = document.getElementById('edit-post-id');
    const editPostContentInput = document.getElementById('edit-post-content');
    const editImagePreview = document.getElementById('edit-image-preview');
    const editPreviewImage = document.getElementById('edit-preview-image');
    
    // Fill form with post data
    editPostIdInput.value = post.id;
    editPostContentInput.value = post.content;
    
    // Set image preview if post has an image
    if (post.image_url) {
      editPreviewImage.src = post.image_url;
      editImagePreview.classList.remove('hidden');
    } else {
      editImagePreview.classList.add('hidden');
    }
    
    // Show modal
    editPostModal.classList.remove('hidden');
  }
  
  // Open reminder modal
  function openReminderModal(postId) {
    reminderPostIdInput.value = postId;
    reminderModal.classList.remove('hidden');
  }
  
  // Open meeting modal
  function openMeetingModal(postId, withUserId, username) {
    meetingPostIdInput.value = postId;
    meetingWithUserInput.value = withUserId;
    meetingTitleInput.value = `Meeting with ${username}`;
    
    // Set min date to now
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset() + 5); // 5 min from now
    meetingTimeInput.min = now.toISOString().slice(0, 16);
    meetingTimeInput.value = now.toISOString().slice(0, 16);
    
    meetingModal.classList.remove('hidden');
  }
  
  // Helper function for image upload
  function handleImageUpload(e, previewImgElement, previewContainer, callback) {
    const file = e.target.files[0];
    if (file) {
      // Check file type
      if (!file.type.match('image.*')) {
        alert('Only image files are allowed');
        e.target.value = '';
        return;
      }
      
      const reader = new FileReader();
      reader.onload = function(e) {
        previewImgElement.src = e.target.result;
        previewContainer.classList.remove('hidden');
        if (callback) callback(file);
      };
      reader.readAsDataURL(file);
    }
  }
  
  // Helper function to remove image
  function removeImage(previewContainer, callback) {
    previewContainer.classList.add('hidden');
    if (callback) callback();
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
  
  // Copy to clipboard
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text)
      .then(() => {
        alert('Link copied to clipboard');
      })
      .catch(err => {
        console.error('Error copying to clipboard:', err);
        
        // Fallback method for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Link copied to clipboard');
      });
  }
  
  // Fix post owner menus
  function fixPostOwnerMenus() {
    console.log("🔧 APPLYING POST MENU FIX");
    const currentUserId = localStorage.getItem('userId');
    console.log("Current user ID:", currentUserId);
    
    // Find all posts in the DOM
    document.querySelectorAll('.post').forEach(post => {
      const postId = post.getAttribute('data-post-id');
      const authorElement = post.querySelector('.author-name');
      const username = authorElement ? authorElement.textContent.trim() : '';
      
      // Find owner info - try multiple approaches to be certain
      const datasetUserId = post.dataset.userId; // If available
      const postHeader = post.closest('.post-header');
      const ownerUsername = localStorage.getItem('username');
      
      // Direct username match is the most reliable indicator
      const isOwner = (username === ownerUsername);
      
      console.log(`Post #${postId} by ${username}, Current user: ${ownerUsername}, isOwner: ${isOwner}`);
      
      if (isOwner) {
        // Force replace the menu with owner options
        const menuDropdown = post.querySelector('.post-menu-dropdown');
        if (menuDropdown) {
          console.log(`⚡ Setting owner menu for post #${postId}`);
          
          // Clear existing menu and add owner options
          menuDropdown.innerHTML = `
            <div class="menu-item edit-option">
              <i class="fas fa-edit"></i> Edit Post
            </div>
            <div class="menu-item archive-option">
              <i class="fas fa-archive"></i> Archive Post
            </div>
            <div class="menu-item delete-option">
              <i class="fas fa-trash"></i> Delete Post
            </div>
          `;
          
          // Directly attach event handlers
          menuDropdown.querySelector('.edit-option').addEventListener('click', function() {
            alert(`Will edit post #${postId}`);
            menuDropdown.classList.add('hidden');
          });
          
          menuDropdown.querySelector('.archive-option').addEventListener('click', function() {
            if (confirm('Are you sure you want to archive this post?')) {
              fetch(`/api/posts/${postId}/archive`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
              })
              .then(response => {
                if (response.ok) {
                  post.remove();
                  alert('Post archived successfully');
                } else {
                  alert('Error archiving post');
                }
              })
              .catch(err => {
                console.error(err);
                alert('Error archiving post');
              });
            }
            menuDropdown.classList.add('hidden');
          });
          
          menuDropdown.querySelector('.delete-option').addEventListener('click', function() {
            if (confirm('Are you sure you want to delete this post? This cannot be undone.')) {
              fetch(`/api/posts/${postId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
              })
              .then(response => {
                if (response.ok) {
                  post.remove();
                  alert('Post deleted successfully');
                } else {
                  alert('Error deleting post');
                }
              })
              .catch(err => {
                console.error(err);
                alert('Error deleting post');
              });
            }
            menuDropdown.classList.add('hidden');
          });
        }
      }
    });
  }
  
  // Run immediately and also when DOM changes
  fixPostOwnerMenus();
  
  // Run after posts load
  document.addEventListener('DOMContentLoaded', function() {
    // Run once on page load
    setTimeout(fixPostOwnerMenus, 1000);
    
    // Create a button to manually trigger the fix
    const actionContainer = document.querySelector('.create-post-actions');
    if (actionContainer) {
      const fixButton = document.createElement('button');
      fixButton.innerText = 'Fix Owner Menus';
      fixButton.className = 'btn-outline';
      fixButton.style.marginLeft = '10px';
      fixButton.addEventListener('click', fixPostOwnerMenus);
      actionContainer.appendChild(fixButton);
    }
    
    // Also hook into any post loading function that might exist
    const originalRenderPosts = window.renderPosts;
    if (typeof originalRenderPosts === 'function') {
      window.renderPosts = function() {
        originalRenderPosts.apply(this, arguments);
        setTimeout(fixPostOwnerMenus, 100);
      };
    }
  });
});
