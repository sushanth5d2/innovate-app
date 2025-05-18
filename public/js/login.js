document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('login-form');
  const forgotPasswordLink = document.getElementById('forgot-password');
  const forgotPasswordForm = document.getElementById('forgot-password-form');
  const resetForm = document.getElementById('reset-form');
  const cancelResetBtn = document.getElementById('cancel-reset');

  // Check if user is already logged in
  if (localStorage.getItem('token')) {
    window.location.href = 'home.html';
  }

  // Handle login form submission
  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
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
        alert(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Error during login:', error);
      alert('An error occurred during login. Please try again.');
    }
  });

  // Show forgot password form
  forgotPasswordLink.addEventListener('click', function(e) {
    e.preventDefault();
    loginForm.classList.add('hidden');
    forgotPasswordForm.classList.remove('hidden');
  });

  // Hide forgot password form
  cancelResetBtn.addEventListener('click', function() {
    forgotPasswordForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
  });

  // Handle password reset form submission
  resetForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const email = document.getElementById('reset-email').value;
    
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      
      alert(data.message);
      
      // Hide the reset form
      forgotPasswordForm.classList.add('hidden');
      loginForm.classList.remove('hidden');
    } catch (error) {
      console.error('Error during password reset:', error);
      alert('An error occurred. Please try again.');
    }
  });
});
