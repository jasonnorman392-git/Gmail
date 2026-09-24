const welcomeText = document.getElementById('welcomeText');
const logoutBtn = document.getElementById('logoutBtn');
const mailList = document.getElementById('mailList');
const messageDetail = document.getElementById('messageDetail');

const email = new URLSearchParams(window.location.search).get('email') || localStorage.getItem('gmailUser') || 'user@gmail.com';

const renderDetail = (message) => {
  messageDetail.classList.remove('hidden');
  messageDetail.innerHTML = `
    <h2>${message.subject}</h2>
    <div class="message-meta">
      From: ${message.sender_name} (${message.sender_email})<br />
      To: ${message.user_email}
    </div>
    <div class="message-body">${message.body.replace(/\n/g, '<br>')}</div>
  `;
};

const renderMessages = (messages) => {
  if (!mailList) return;

  mailList.innerHTML = messages.map((message) => `
    <article class="mail-item ${message.is_read ? '' : 'unread'}" data-id="${message.id}">
      <div class="sender">${message.sender_name}</div>
      <div class="subject">${message.subject}</div>
      <div class="preview">${message.preview}</div>
      <div class="time">${new Date(message.created_at).toLocaleDateString()}</div>
    </article>
  `).join('');

  mailList.querySelectorAll('.mail-item').forEach((item) => {
    item.addEventListener('click', async () => {
      const id = item.dataset.id;
      const response = await fetch(`http://localhost:3000/api/messages/${id}`, { credentials: 'include' });
      const data = await response.json();
      if (data.message) {
        renderDetail(data.message);
      }

      if (response.ok) {
        fetch('http://localhost:3000/api/inbox', { credentials: 'include' })
          .then((res) => res.json())
          .then((body) => renderMessages(body.messages || []));
      }
    });
  });
};

const loadInbox = async () => {
  try {
    const response = await fetch('http://localhost:3000/api/inbox', { credentials: 'include' });
    if (!response.ok) {
      window.location.href = '/';
      return;
    }

    const data = await response.json();
    if (welcomeText) {
      welcomeText.textContent = `Welcome, ${data.user.full_name || data.user.email}`;
    }

    renderMessages(data.messages || []);
  } catch (error) {
    console.error('Inbox load failed:', error);
    window.location.href = '/';
  }
};

if (welcomeText) {
  welcomeText.textContent = `Welcome, ${email}`;
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await fetch('http://localhost:3000/api/logout', {
      method: 'POST',
      credentials: 'include'
    });
    localStorage.removeItem('gmailUser');
    window.location.href = '/';
  });
}

loadInbox();
