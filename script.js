const form = document.getElementById('loginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const formMessage = document.getElementById('formMessage');
const togglePasswordButton = document.getElementById('togglePassword');

const setMessage = (message, type = '') => {
  formMessage.textContent = message;
  formMessage.className = 'form-message';

  if (type) {
    formMessage.classList.add(type);
  }
};

togglePasswordButton.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  togglePasswordButton.textContent = isPassword ? 'Hide' : 'Show';
  togglePasswordButton.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
});

const checkSession = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/session', { credentials: 'include' });
    const data = await response.json();
    if (data.authenticated && data.user) {
      window.location.href = `/dashboard?email=${encodeURIComponent(data.user.email)}`;
    }
  } catch (error) {
    console.error('Session check failed:', error);
  }
};

checkSession();

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    setMessage('Please enter both your email and password.', 'error');
    return;
  }

  if (!email.includes('@')) {
    setMessage('Please enter a valid email address.', 'error');
    return;
  }

  setMessage('Signing in...', 'success');

  try {
    const response = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message || 'Login failed.', 'error');
      return;
    }

    localStorage.setItem('gmailUser', data.user.email);
    setMessage(`Welcome back, ${data.user.email}!`, 'success');
    form.reset();

    setTimeout(() => {
      window.location.href = `/dashboard?email=${encodeURIComponent(data.user.email)}`;
    }, 600);
  } catch (error) {
    setMessage('Unable to reach the server. Please check that it is running.', 'error');
    console.error(error);
  }
});
