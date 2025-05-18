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
  const createEventBtn = document.getElementById('create-event-btn');
  const createEventModal = document.getElementById('create-event-modal');
  const closeModalButtons = document.querySelectorAll('.close-modal, .cancel-modal');
  const createEventForm = document.getElementById('create-event-form');
  const attendeeSearch = document.getElementById('attendee-search');
  const attendeeResults = document.getElementById('attendee-results');
  const selectedAttendees = document.getElementById('selected-attendees');
  const eventsList = document.getElementById('events-list');
  const eventDetailsModal = document.getElementById('event-details-modal');
  const calendar = document.getElementById('calendar');
  const currentMonthElement = document.getElementById('current-month');
  const prevMonthBtn = document.getElementById('prev-month');
  const nextMonthBtn = document.getElementById('next-month');
  const eventCardTemplate = document.getElementById('event-card-template');
  
  // Variables
  let currentDate = new Date();
  let currentMonth = currentDate.getMonth();
  let currentYear = currentDate.getFullYear();
  let selectedAttendeesList = [];
  let allEvents = [];
  
  // Check URL params for specific actions
  const urlParams = new URLSearchParams(window.location.search);
  const createWithUser = urlParams.get('create') === 'true' && urlParams.get('with');
  const viewEventId = urlParams.get('id');
  
  // Initialize
  updateCalendar(currentMonth, currentYear);
  loadEvents();
  
  // If URL indicates creating event with specific user
  if (createWithUser) {
    const withUserId = urlParams.get('with');
    fetchUser(withUserId).then(user => {
      if (user) {
        selectedAttendeesList = [user];
        renderSelectedAttendees();
        openCreateEventModal();
      }
    });
  }
  
  // If URL indicates viewing specific event
  if (viewEventId) {
    fetchEventDetails(viewEventId).then(event => {
      if (event) {
        openEventDetailsModal(event);
      }
    });
  }
  
  // Month navigation
  prevMonthBtn.addEventListener('click', function() {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    updateCalendar(currentMonth, currentYear);
  });
  
  nextMonthBtn.addEventListener('click', function() {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    updateCalendar(currentMonth, currentYear);
  });
  
  // Open create event modal
  createEventBtn.addEventListener('click', function() {
    openCreateEventModal();
  });
  
  // Close modals
  closeModalButtons.forEach(button => {
    button.addEventListener('click', function() {
      createEventModal.classList.add('hidden');
      eventDetailsModal.classList.add('hidden');
    });
  });
  
  // Close modals when clicking outside
  window.addEventListener('click', function(e) {
    if (e.target === createEventModal) {
      createEventModal.classList.add('hidden');
    }
    if (e.target === eventDetailsModal) {
      eventDetailsModal.classList.add('hidden');
    }
  });
  
  // Attendee search
  attendeeSearch.addEventListener('input', function() {
    const query = this.value.trim();
    
    if (query.length < 1) {
      attendeeResults.classList.add('hidden');
      return;
    }
    
    // Search users
    searchUsers(query).then(users => {
      // Filter out already selected users
      const filteredUsers = users.filter(user => 
        !selectedAttendeesList.some(selected => selected.id === user.id)
      );
      
      if (filteredUsers.length > 0) {
        renderAttendeeResults(filteredUsers);
        attendeeResults.classList.remove('hidden');
      } else {
        attendeeResults.classList.add('hidden');
      }
    });
  });
  
  // Create event form submission
  createEventForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const title = document.getElementById('event-title').value.trim();
    const date = document.getElementById('event-date').value;
    const description = document.getElementById('event-description').value.trim();
    
    if (!title || !date) {
      alert('Title and date are required');
      return;
    }
    
    try {
      const formData = {
        title,
        date,
        description,
        attendees: selectedAttendeesList.map(a => a.id)
      };
      
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Reset form
        createEventForm.reset();
        selectedAttendeesList = [];
        renderSelectedAttendees();
        createEventModal.classList.add('hidden');
        
        // Reload events
        loadEvents();
        
        // Show success alert
        alert('Event created successfully!');
      } else {
        alert(data.message || 'Error creating event');
      }
    } catch (error) {
      console.error('Error creating event:', error);
      alert('An error occurred while creating the event');
    }
  });
  
  // Update calendar with events
  function updateCalendar(month, year) {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    
    // Update month display
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June', 
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    currentMonthElement.textContent = `${monthNames[month]} ${year}`;
    
    // Clear calendar
    calendar.innerHTML = '';
    
    // Add day headers
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    dayNames.forEach(day => {
      const dayHeader = document.createElement('div');
      dayHeader.className = 'calendar-day-header';
      dayHeader.textContent = day;
      calendar.appendChild(dayHeader);
    });
    
    // Add days from previous month
    for (let i = 0; i < firstDay; i++) {
      const prevMonthDay = new Date(year, month, 0).getDate() - firstDay + i + 1;
      const dayElement = createCalendarDay(prevMonthDay, true);
      calendar.appendChild(dayElement);
    }
    
    // Add days from current month
    for (let i = 1; i <= daysInMonth; i++) {
      const isToday = 
        i === today.getDate() && 
        month === today.getMonth() && 
        year === today.getFullYear();
      
      const dayElement = createCalendarDay(i, false, isToday);
      
      // Add events for this day
      const dayDate = new Date(year, month, i);
      const eventsOnDay = allEvents.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate.getDate() === dayDate.getDate() && 
               eventDate.getMonth() === dayDate.getMonth() && 
               eventDate.getFullYear() === dayDate.getFullYear();
      });
      
      if (eventsOnDay.length > 0) {
        dayElement.classList.add('has-events');
        
        // Add up to 3 events
        eventsOnDay.slice(0, 3).forEach(event => {
          const eventElement = document.createElement('div');
          eventElement.className = 'calendar-event';
          eventElement.textContent = event.title;
          eventElement.addEventListener('click', function(e) {
            e.stopPropagation();
            openEventDetailsModal(event);
          });
          dayElement.appendChild(eventElement);
        });
        
        // If more than 3 events, add a "more" indicator
        if (eventsOnDay.length > 3) {
          const moreElement = document.createElement('div');
          moreElement.className = 'calendar-event';
          moreElement.textContent = `+${eventsOnDay.length - 3} more`;
          dayElement.appendChild(moreElement);
        }
      }
      
      calendar.appendChild(dayElement);
    }
    
    // Add days from next month
    const totalDaysShown = firstDay + daysInMonth;
    const daysFromNextMonth = 42 - totalDaysShown; // 6 rows of 7 days = 42
    
    for (let i = 1; i <= daysFromNextMonth; i++) {
      const dayElement = createCalendarDay(i, true);
      calendar.appendChild(dayElement);
    }
  }
  
  // Create a calendar day element
  function createCalendarDay(day, isOtherMonth = false, isToday = false) {
    const dayElement = document.createElement('div');
    dayElement.className = 'calendar-day';
    
    if (isOtherMonth) {
      dayElement.classList.add('other-month');
    }
    
    if (isToday) {
      dayElement.classList.add('today');
    }
    
    const dayNumber = document.createElement('div');
    dayNumber.className = 'calendar-day-number';
    dayNumber.textContent = day;
    dayElement.appendChild(dayNumber);
    
    return dayElement;
  }
  
  // Load all events
  async function loadEvents() {
    try {
      eventsList.innerHTML = `
        <div class="loading-indicator">
          <i class="fas fa-spinner fa-spin"></i> Loading events...
        </div>
      `;
      
      const response = await fetch('/api/events', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        allEvents = data.events;
        
        // Update calendar with events
        updateCalendar(currentMonth, currentYear);
        
        // Render upcoming events
        renderEvents(allEvents);
      } else {
        eventsList.innerHTML = `<p>Error loading events: ${data.message}</p>`;
      }
    } catch (error) {
      console.error('Error loading events:', error);
      eventsList.innerHTML = `<p>Error loading events</p>`;
    }
  }
  
  // Render events list
  function renderEvents(events) {
    if (!events || events.length === 0) {
      eventsList.innerHTML = `<p>No upcoming events</p>`;
      return;
    }
    
    // Sort events by date
    events.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Filter to show only upcoming events
    const now = new Date();
    const upcomingEvents = events.filter(event => new Date(event.date) >= now);
    
    if (upcomingEvents.length === 0) {
      eventsList.innerHTML = `<p>No upcoming events</p>`;
      return;
    }
    
    eventsList.innerHTML = '';
    
    upcomingEvents.forEach(event => {
      const eventCard = createEventCard(event);
      eventsList.appendChild(eventCard);
    });
  }
  
  // Create event card
  function createEventCard(event) {
    const card = document.importNode(eventCardTemplate.content, true).querySelector('.event-card');
    
    const eventDate = new Date(event.date);
    const eventMonth = eventDate.toLocaleString('default', { month: 'short' });
    const eventDay = eventDate.getDate();
    const eventTime = eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    card.querySelector('.event-month').textContent = eventMonth;
    card.querySelector('.event-day').textContent = eventDay;
    card.querySelector('.event-title').textContent = event.title;
    card.querySelector('.event-time').textContent = `${eventDate.toDateString()}, ${eventTime}`;
    card.querySelector('.host-name').textContent = event.creator_name || 'Unknown';
    
    // Set status badge
    const statusBadge = card.querySelector('.status-badge');
    if (event.creator_id === parseInt(userId)) {
      statusBadge.textContent = 'Hosting';
      statusBadge.classList.add('hosting');
    } else {
      const status = event.status || 'pending';
      statusBadge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
      statusBadge.classList.add(status);
    }
    
    // Open event details on click
    card.addEventListener('click', function() {
      openEventDetailsModal(event);
    });
    
    return card;
  }
  
  // Open create event modal
  function openCreateEventModal() {
    // Set min date to today
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    document.getElementById('event-date').min = today.toISOString().slice(0, 16);
    
    // Reset form
    createEventForm.reset();
    
    // Show modal
    createEventModal.classList.remove('hidden');
    
    // Focus title input
    document.getElementById('event-title').focus();
  }
  
  // Open event details modal
  function openEventDetailsModal(event) {
    // Set event details
    document.getElementById('event-details-title').textContent = event.title;
    
    const eventDate = new Date(event.date);
    document.getElementById('event-details-date').textContent = 
      `${eventDate.toDateString()} at ${eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    
    document.getElementById('event-details-host').textContent = event.creator_name || 'Unknown';
    document.getElementById('event-details-description-text').textContent = event.description || 'No description';
    
    // Load attendees
    loadEventAttendees(event.id);
    
    // Set actions based on user role
    const actionsContainer = document.getElementById('event-details-actions');
    actionsContainer.innerHTML = '';
    
    if (event.creator_id === parseInt(userId)) {
      // Creator actions
      actionsContainer.innerHTML = `
        <button id="edit-event" class="btn-outline">Edit Event</button>
        <button id="cancel-event" class="btn-outline">Cancel Event</button>
      `;
      
      document.getElementById('edit-event').addEventListener('click', function() {
        // Implement event editing
        alert('Edit functionality coming soon');
      });
      
      document.getElementById('cancel-event').addEventListener('click', async function() {
        if (confirm('Are you sure you want to cancel this event?')) {
          try {
            const response = await fetch(`/api/events/${event.id}`, {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (response.ok) {
              eventDetailsModal.classList.add('hidden');
              loadEvents();
              alert('Event cancelled successfully');
            } else {
              const data = await response.json();
              alert(data.message || 'Error cancelling event');
            }
          } catch (error) {
            console.error('Error cancelling event:', error);
            alert('An error occurred while cancelling the event');
          }
        }
      });
    } else {
      // Attendee actions
      const statusButtons = `
        <button id="going-btn" class="btn-primary">Going</button>
        <button id="not-going-btn" class="btn-outline">Not Going</button>
      `;
      
      actionsContainer.innerHTML = statusButtons;
      
      document.getElementById('going-btn').addEventListener('click', function() {
        updateAttendeeStatus(event.id, 'going');
      });
      
      document.getElementById('not-going-btn').addEventListener('click', function() {
        updateAttendeeStatus(event.id, 'not-going');
      });
      
      // Highlight current status
      if (event.status === 'going') {
        document.getElementById('going-btn').classList.add('active');
      } else if (event.status === 'not-going') {
        document.getElementById('not-going-btn').classList.add('active');
      }
    }
    
    // Show modal
    eventDetailsModal.classList.remove('hidden');
  }
  
  // Load event attendees
  async function loadEventAttendees(eventId) {
    const attendeesList = document.getElementById('event-details-attendees-list');
    attendeesList.innerHTML = `
      <div class="loading-indicator">
        <i class="fas fa-spinner fa-spin"></i> Loading attendees...
      </div>
    `;
    
    try {
      const response = await fetch(`/api/events/${eventId}/attendees`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (data.attendees.length === 0) {
          attendeesList.innerHTML = '<p>No attendees yet</p>';
          return;
        }
        
        attendeesList.innerHTML = '';
        
        data.attendees.forEach(attendee => {
          const attendeeElement = document.createElement('div');
          attendeeElement.className = 'attendee-list-item';
          
          attendeeElement.innerHTML = `
            <div class="attendee-avatar">
              <i class="fas fa-user-circle"></i>
            </div>
            <div class="attendee-name">${attendee.username}</div>
            <div class="attendee-status ${attendee.status}">${attendee.status}</div>
          `;
          
          attendeesList.appendChild(attendeeElement);
        });
      } else {
        attendeesList.innerHTML = `<p>Error loading attendees: ${data.message}</p>`;
      }
    } catch (error) {
      console.error('Error loading attendees:', error);
      attendeesList.innerHTML = '<p>Error loading attendees</p>';
    }
  }
  
  // Update attendee status
  async function updateAttendeeStatus(eventId, status) {
    try {
      const response = await fetch(`/api/events/${eventId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      
      if (response.ok) {
        // Update UI
        const goingBtn = document.getElementById('going-btn');
        const notGoingBtn = document.getElementById('not-going-btn');
        
        if (status === 'going') {
          goingBtn.classList.add('active');
          notGoingBtn.classList.remove('active');
        } else {
          goingBtn.classList.remove('active');
          notGoingBtn.classList.add('active');
        }
        
        // Reload attendees
        loadEventAttendees(eventId);
        
        // Reload events to update status badges
        loadEvents();
      } else {
        const data = await response.json();
        alert(data.message || 'Error updating status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('An error occurred while updating your status');
    }
  }
  
  // Fetch user details
  async function fetchUser(userId) {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.user;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }
  
  // Fetch event details
  async function fetchEventDetails(eventId) {
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.event;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching event details:', error);
      return null;
    }
  }
  
  // Search users
  async function searchUsers(query) {
    try {
      const response = await fetch(`/api/search/users?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.users;
      }
      
      return [];
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }
  
  // Render attendee search results
  function renderAttendeeResults(users) {
    attendeeResults.innerHTML = '';
    
    users.forEach(user => {
      const resultElement = document.createElement('div');
      resultElement.className = 'attendee-result';
      resultElement.textContent = user.username;
      
      resultElement.addEventListener('click', function() {
        selectedAttendeesList.push(user);
        renderSelectedAttendees();
        attendeeSearch.value = '';
        attendeeResults.classList.add('hidden');
      });
      
      attendeeResults.appendChild(resultElement);
    });
  }
  
  // Render selected attendees
  function renderSelectedAttendees() {
    selectedAttendees.innerHTML = '';
    
    selectedAttendeesList.forEach(user => {
      const chipElement = document.createElement('div');
      chipElement.className = 'attendee-chip';
      chipElement.innerHTML = `
        ${user.username} 
        <span class="remove-attendee" data-id="${user.id}">&times;</span>
      `;
      
      selectedAttendees.appendChild(chipElement);
    });
    
    // Add click handlers for remove buttons
    const removeButtons = document.querySelectorAll('.remove-attendee');
    removeButtons.forEach(button => {
      button.addEventListener('click', function() {
        const userId = this.getAttribute('data-id');
        selectedAttendeesList = selectedAttendeesList.filter(user => user.id.toString() !== userId);
        renderSelectedAttendees();
      });
    });
  }
});
