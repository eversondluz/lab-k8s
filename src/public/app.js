const statusElement = document.querySelector('#api-status');
const statusText = document.querySelector('#api-status-text');
const form = document.querySelector('#message-form');
const nameInput = document.querySelector('#name');
const messageInput = document.querySelector('#message');
const feedback = document.querySelector('#feedback');
const messagesList = document.querySelector('#messages-list');
const refreshButton = document.querySelector('#refresh-button');
const submitButton = form.querySelector('button[type="submit"]');

function setApiStatus(online) {
  statusElement.classList.remove('status-checking', 'status-online', 'status-offline');
  statusElement.classList.add(online ? 'status-online' : 'status-offline');
  statusText.textContent = online ? 'API e banco disponíveis' : 'API indisponível';
}

function setFeedback(message, isError = false) {
  feedback.textContent = message;
  feedback.classList.toggle('error', isError);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || 'A API retornou um erro.');
  }

  return payload;
}

function renderMessages(messages) {
  messagesList.replaceChildren();

  if (messages.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Nenhuma mensagem ainda. Seja o primeiro a publicar.';
    messagesList.append(empty);
    return;
  }

  messages.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'message-item';

    const meta = document.createElement('div');
    meta.className = 'message-meta';

    const name = document.createElement('span');
    name.className = 'message-name';
    name.textContent = item.name;

    const date = document.createElement('time');
    date.className = 'message-date';
    date.dateTime = item.created_at;
    date.textContent = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(item.created_at));

    const text = document.createElement('p');
    text.className = 'message-text';
    text.textContent = item.message;

    meta.append(name, date);
    card.append(meta, text);
    messagesList.append(card);
  });
}

async function loadMessages() {
  messagesList.innerHTML = '<p class="empty-state">Consultando o PostgreSQL...</p>';

  try {
    const payload = await request('/api/messages');
    renderMessages(payload.messages);
    setApiStatus(true);
  } catch (error) {
    messagesList.innerHTML = '<p class="empty-state">Não foi possível carregar as mensagens.</p>';
    setApiStatus(false);
  }
}

async function checkApi() {
  try {
    await request('/ready');
    setApiStatus(true);
  } catch (error) {
    setApiStatus(false);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setFeedback('Salvando...');
  submitButton.disabled = true;

  try {
    await request('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ name: nameInput.value, message: messageInput.value }),
    });
    form.reset();
    setFeedback('Mensagem salva no PostgreSQL.');
    await loadMessages();
  } catch (error) {
    setFeedback(error.message, true);
    setApiStatus(false);
  } finally {
    submitButton.disabled = false;
  }
});

refreshButton.addEventListener('click', loadMessages);

checkApi();
loadMessages();
setInterval(checkApi, 15000);
