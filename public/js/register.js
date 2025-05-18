document.addEventListener('DOMContentLoaded', function() {
  const registerForm = document.getElementById('register-form');

  // Check if user is already logged in
  if (localStorage.getItem('token')) {
    window.location.href = 'home.html';
  }

  // Handle registration form submission
  registerForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // Validate passwords match
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Store authentication data
        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', data.userId);
        localStorage.setItem('username', data.username);
        
        // Redirect to home page
        window.location.href = 'home.html';
      } else {
        alert(data.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Error during registration:', error);
      alert('An error occurred during registration. Please try again.');
    }
  });
});
