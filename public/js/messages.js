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
  
  // Initialize Socket.IO connection
  const socket = io();
  
  // Authenticate socket
  socket.emit('authenticate', { userId });
  
  // DOM elements
  const contactsList = document.getElementById('contacts-list');
  const searchContacts = document.getElementById('search-contacts');
  const chatArea = document.getElementById('chat-area');
  const noChatSelected = document.querySelector('.no-chat-selected');
  const messagesList = document.getElementById('messages-list');
  const messageForm = document.getElementById('message-form');
  const messageInput = document.getElementById('message-input');
  const attachmentInput = document.getElementById('attachment-input');
  const viewProfileBtn = document.getElementById('view-profile');
  const contactTemplate = document.getElementById('contact-template');
  const messageTemplate = document.getElementById('message-template');
  
  // Variables
  let activeContact = null;
  let selectedAttachment = null;
  
  // Handle new messages from socket
  socket.on('new_message', function(data) {
    // Add to messages list if chat is open with sender
    if (activeContact && parseInt(activeContact.id) === parseInt(data.senderId)) {
      const message = {
        content: data.message,
        created_at: data.timestamp,
        is_outgoing: 0
      };
      addMessageToChat(message);
      scrollToBottom();
      
      // Mark message as read
      markMessagesAsRead(activeContact.id);
    } else {
      // Update contacts list to show new message notification
      loadContacts();
    }
  });
  
  // Check URL params for direct message
  const urlParams = new URLSearchParams(window.location.search);
  const directMessageUserId = urlParams.get('user');
  
  // Load contacts list
  loadContacts().then(() => {
    if (directMessageUserId) {
      openConversation(directMessageUserId);
    }
  });
  
  // Search contacts
  searchContacts.addEventListener('input', function() {
    const searchTerm = this.value.toLowerCase();
    const contacts = contactsList.querySelectorAll('.contact');
    
    contacts.forEach(contact => {
      const name = contact.querySelector('.contact-name').textContent.toLowerCase();
      if (name.includes(searchTerm)) {
        contact.style.display = 'flex';
      } else {
        contact.style.display = 'none';
      }
    });
  });
  
  // Handle message form submission
  messageForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    if (!activeContact) return;
    
    const content = messageInput.value.trim();
    if (!content && !selectedAttachment) {
      return;
    }
    
    // Create FormData for message with possible attachment
    const formData = new FormData();
    formData.append('receiverId', activeContact.id);
    formData.append('content', content);
    
    if (selectedAttachment) {
      formData.append('attachment', selectedAttachment);
    }
    
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Add message to chat
        addMessageToChat(data.data);
        
        // Clear input
        messageInput.value = '';
        selectedAttachment = null;
        
        // Emit socket message
        socket.emit('private_message', {
          receiverId: activeContact.id,
          message: content
        });
        
        // Scroll to bottom
        scrollToBottom();
      } else {
        const errorData = await response.json();
        alert(errorData.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message. Please try again.');
    }
  });
  
  // Handle attachment selection
  attachmentInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    selectedAttachment = file;
    
    // Add file name to input
    messageInput.value += `[File: ${file.name}] `;
    messageInput.focus();
  });
  
  // View profile button
  viewProfileBtn.addEventListener('click', function() {
    if (activeContact) {
      window.location.href = `profile.html?id=${activeContact.id}`;
    }
  });
  
  // Load contacts from API
  async function loadContacts() {
    try {
      contactsList.innerHTML = `
        <div class="loading-indicator">
          <i class="fas fa-spinner fa-spin"></i> Loading contacts...
        </div>
      `;
      
      const response = await fetch('/api/messages/conversations', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        renderContacts(data.conversations);
      } else {
        contactsList.innerHTML = `<p>Error loading conversations</p>`;
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
      contactsList.innerHTML = `<p>Error loading conversations</p>`;
    }
  }
  
  // Render contacts list
  function renderContacts(conversations) {
    contactsList.innerHTML = '';
    
    if (!conversations || conversations.length === 0) {
      contactsList.innerHTML = `<p class="no-contacts">No conversations yet</p>`;
      return;
    }
    
    conversations.forEach(conversation => {
      const contactElement = createContactElement(conversation);
      contactsList.appendChild(contactElement);
    });
  }
  
  // Create contact element
  function createContactElement(conversation) {
    const contactElement = document.importNode(contactTemplate.content, true).querySelector('.contact');
    
    contactElement.setAttribute('data-contact-id', conversation.contact_id);
    contactElement.querySelector('.contact-name').textContent = conversation.contact_name;
    contactElement.querySelector('.contact-time').textContent = formatDate(conversation.last_message_time);
    contactElement.querySelector('.contact-last-message').textContent = conversation.last_message;
    
    const unreadBadge = contactElement.querySelector('.contact-unread-badge');
    if (conversation.unread_count > 0) {
      unreadBadge.textContent = conversation.unread_count;
      unreadBadge.classList.remove('hidden');
    }
    
    contactElement.addEventListener('click', function() {
      openConversation(conversation.contact_id);
    });
    
    return contactElement;
  }
  
  // Open conversation
  async function openConversation(contactId) {
    try {
      // Update active contact in UI
      const contacts = contactsList.querySelectorAll('.contact');
      contacts.forEach(contact => {
        contact.classList.remove('active');
        if (contact.getAttribute('data-contact-id') === contactId.toString()) {
          contact.classList.add('active');
          contact.querySelector('.contact-unread-badge').classList.add('hidden');
        }
      });
      
      // Show loading in messages list
      messagesList.innerHTML = `
        <div class="loading-indicator">
          <i class="fas fa-spinner fa-spin"></i> Loading messages...
        </div>
      `;
      
      // Show chat area, hide no chat selected
      noChatSelected.classList.add('hidden');
      chatArea.classList.remove('hidden');
      
      // Fetch messages
      const response = await fetch(`/api/messages/conversation/${contactId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Set active contact
        activeContact = data.contact;
        
        // Update chat header
        document.querySelector('.user-name').textContent = data.contact.username;
        document.querySelector('.user-status').textContent = 'Online'; // For demo, we'll assume online
        
        // Render messages
        renderMessages(data.messages);
        
        // Focus message input
        messageInput.focus();
        
        // Mark messages as read
        markMessagesAsRead(contactId);
      } else {
        messagesList.innerHTML = `<p>Error loading messages</p>`;
      }
    } catch (error) {
      console.error('Error opening conversation:', error);
      messagesList.innerHTML = `<p>Error loading messages</p>`;
    }
  }
  
  // Render messages
  function renderMessages(messages) {
    messagesList.innerHTML = '';
    
    if (!messages || messages.length === 0) {
      messagesList.innerHTML = `<p class="no-messages">No messages yet. Say hello!</p>`;
      return;
    }
    
    let currentDate = null;
    
    messages.forEach(message => {
      // Add date divider if date changes
      const messageDate = new Date(message.created_at).toLocaleDateString();
      if (messageDate !== currentDate) {
        const dateDivider = document.createElement('div');
        dateDivider.className = 'date-divider';
        dateDivider.textContent = messageDate;
        messagesList.appendChild(dateDivider);
        currentDate = messageDate;
      }
      
      // Add message
      addMessageToChat(message, false);
    });
    
    // Scroll to bottom
    scrollToBottom();
  }
  
  // Add message to chat
  function addMessageToChat(message, shouldScroll = true) {
    const messageElement = document.importNode(messageTemplate.content, true).querySelector('.message');
    
    // Set message content
    messageElement.querySelector('.message-content').textContent = message.content;
    messageElement.querySelector('.message-time').textContent = formatTime(message.created_at);
    
    // Set class based on outgoing/incoming
    if (message.is_outgoing) {
      messageElement.classList.add('outgoing');
      
      // Show edit/unsend options for outgoing messages
      messageElement.querySelector('.edit-message').classList.remove('hidden');
      messageElement.querySelector('.unsend-message').classList.remove('hidden');
    } else {
      messageElement.classList.add('incoming');
    }
    
    // Set up message menu
    setupMessageMenu(messageElement, message);
    
    // Add to messages list
    messagesList.appendChild(messageElement);
    
    // Scroll if needed
    if (shouldScroll) {
      scrollToBottom();
    }
  }
  
  // Setup message menu
  function setupMessageMenu(messageElement, message) {
    const menuBtn = messageElement.querySelector('.message-menu-btn');
    const menuDropdown = messageElement.querySelector('.message-menu-dropdown');
    
    // Toggle menu
    menuBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      menuDropdown.classList.toggle('hidden');
      
      // Close other menus
      document.querySelectorAll('.message-menu-dropdown:not(.hidden)').forEach(dropdown => {
        if (dropdown !== menuDropdown) {
          dropdown.classList.add('hidden');
        }
      });
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', function() {
      menuDropdown.classList.add('hidden');
    });
    
    // Menu item actions
    const replyBtn = messageElement.querySelector('.reply-message');
    const copyBtn = messageElement.querySelector('.copy-message');
    const editBtn = messageElement.querySelector('.edit-message');
    const unsendBtn = messageElement.querySelector('.unsend-message');
    const deleteBtn = messageElement.querySelector('.delete-message');
    const forwardBtn = messageElement.querySelector('.forward-message');
    
    // Copy message
    copyBtn.addEventListener('click', function() {
      navigator.clipboard.writeText(message.content)
        .then(() => {
          // Feedback
        }).catch(err => {
          console.error('Failed to copy text: ', err);
        });
    });
    
    // Delete message
    deleteBtn.addEventListener('click', async function() {
      if (confirm('Delete this message?')) {
        try {
          const response = await fetch(`/api/messages/${message.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            messageElement.remove();
          } else {
            const data = await response.json();
            alert(data.message);
          }
        } catch (error) {
          console.error('Error deleting message:', error);
        }
      }
    });
    
    // Other actions would be implemented similarly
  }
  
  // Mark messages as read
  async function markMessagesAsRead(contactId) {
    try {
      await fetch(`/api/messages/conversation/${contactId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }
  
  // Scroll to bottom of messages
  function scrollToBottom() {
    messagesList.scrollTop = messagesList.scrollHeight;
  }
  
  // Format date for contacts
  function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
      return formatTime(date);
    } else if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
  }
  
  // Format time for messages
  function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
});
