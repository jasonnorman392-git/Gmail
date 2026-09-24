const signupForm = document.getElementById('signupForm');
const fullNameInput = document.getElementById('fullName');
const signupEmailInput = document.getElementById('signupEmail');
const signupPasswordInput = document.getElementById('signupPassword');
const signupMessage = document.getElementById('signupMessage');
const toggleSignupPasswordButton = document.getElementById('toggleSignupPassword');

const setMessage = (message, type = '') => {
  signupMessage.textContent = message;
  signupMessage.className = 'form-message';
  if (type) signupMessage.classList.add(type);
};

toggleSignupPasswordButton.addEventListener('click', () => {
  const isPassword = signupPasswordInput.type === 'password';
  signupPasswordInput.type = isPassword ? 'text' : 'password';
  toggleSignupPasswordButton.textContent = isPassword ? 'Hide' : 'Show';
  toggleSignupPasswordButton.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
});

signupForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const fullName = fullNameInput.value.trim();
  const email = signupEmailInput.value.trim();
  const password = signupPasswordInput.value.trim();

  if (!fullName || !email || !password) {
    setMessage('Please complete all fields.', 'error');
    return;
  }

  if (!email.includes('@')) {
    setMessage('Please enter a valid email address.', 'error');
    return;
  }

  if (password.length < 6) {
    setMessage('Password must be at least 6 characters long.', 'error');
    return;
  }

  try {
    const response = await fetch('http://localhost:3000/api/signup', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.message || 'Signup failed.', 'error');
      return;
    }

    localStorage.setItem('gmailUser', data.user.email);
    setMessage('Account created successfully!', 'success');
    signupForm.reset();

    setTimeout(() => {
      window.location.href = `/dashboard.html?email=${encodeURIComponent(data.user.email)}`;
    }, 500);
  } catch (error) {
    console.error(error);
    setMessage('Unable to reach the server.', 'error');
  }
});
