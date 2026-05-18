const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const DATA_DIR = './data';
const USERS_FILE = `${DATA_DIR}/users.json`;
const CHATS_FILE = `${DATA_DIR}/chats.json`;

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]');
if (!fs.existsSync(CHATS_FILE)) fs.writeFileSync(CHATS_FILE, '[]');

function loadChats() { return JSON.parse(fs.readFileSync(CHATS_FILE)); }
function saveChats(chats) { fs.writeFileSync(CHATS_FILE, JSON.stringify(chats, null, 2)); }

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.post('/api/submit-form', (req, res) => {
  const user = { ...req.body, userId: uuidv4(), chatId: `chat_${uuidv4()}`, timestamp: new Date().toISOString() };
  let users = JSON.parse(fs.readFileSync(USERS_FILE));
  users.push(user);
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

  let chats = loadChats();
  chats.push({ chatId: user.chatId, messages: [], operatorName: null, isConnected: false, isEnded: false });
  saveChats(chats);

  try { require('./bot').notifyManagers(user); } catch (e) {}
  res.json({ success: true, chatUrl: `/chat.html?chatId=${user.chatId}&role=user` });
});

app.post('/api/connect-operator', (req, res) => {
  const { chatId, operatorName } = req.body;
  let chats = loadChats();
  const chat = chats.find(c => c.chatId === chatId);
  if (chat) {
    chat.operatorName = operatorName;
    chat.isConnected = true;
    saveChats(chats);
    io.to(chatId).emit('operator-connected', { operatorName });
    res.json({ success: true });
  } else res.json({ success: false });
});

app.get('/api/chat-status/:chatId', (req, res) => {
  const chats = loadChats();
  const chat = chats.find(c => c.chatId === req.params.chatId);
  res.json({ operatorName: chat?.operatorName || null, isConnected: chat?.isConnected || false, isEnded: chat?.isEnded || false });
});

app.get('/api/chat/:chatId', (req, res) => {
  const chats = loadChats();
  const chat = chats.find(c => c.chatId === req.params.chatId);
  res.json({ messages: chat ? chat.messages : [] });
});

app.post('/api/send-message', (req, res) => {
  const { chatId, text, isClient, fileName, fileUrl } = req.body;
  let chats = loadChats();
  const chat = chats.find(c => c.chatId === chatId);
  if (chat) {
    const message = { id: Date.now(), text: text || '', isClient: !!isClient, fileName, fileUrl, timestamp: new Date().toISOString() };
    chat.messages.push(message);
    saveChats(chats);
    io.to(chatId).emit('new-message', message);
  }
  res.json({ success: true });
});

app.post('/api/end-chat', (req, res) => {
  const { chatId } = req.body;
  let chats = loadChats();
  const chat = chats.find(c => c.chatId === chatId);
  if (chat) {
    chat.isEnded = true;
    saveChats(chats);
    io.to(chatId).emit('chat-ended');
    res.json({ success: true });
  }
});

io.on('connection', (socket) => {
  socket.on('join-chat', (chatId) => socket.join(chatId));

  socket.on('typing', (chatId) => socket.to(chatId).emit('typing'));
  socket.on('stop-typing', (chatId) => socket.to(chatId).emit('stop-typing'));

  socket.on('send-message', (data) => {
    const { chatId, text, isClient, fileName, fileUrl } = data;
    let chats = loadChats();
    const chat = chats.find(c => c.chatId === chatId);
    if (chat && !chat.isEnded) {
      const message = { id: Date.now(), text: text || '', isClient: !!isClient, fileName, fileUrl, timestamp: new Date().toISOString() };
      chat.messages.push(message);
      saveChats(chats);
      socket.to(chatId).emit('new-message', message);
      socket.emit('message-sent', message);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Сервер запущен: http://localhost:${PORT}`));