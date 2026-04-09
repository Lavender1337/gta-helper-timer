const express = require('express');
const app = express();
app.use(express.json());

// === CORS ДЛЯ TELEGRAM MINI APP ===
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const BOT_TOKEN = process.env.BOT_TOKEN;
console.log('🚀 Сервер запущен. BOT_TOKEN:', BOT_TOKEN ? '✅ ЕСТЬ' : '❌ НЕТ!');

// Тестовый эндпоинт
app.get('/test-bot', async (req, res) => {
  if (!BOT_TOKEN) return res.send('❌ BOT_TOKEN не установлен');
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const data = await r.json();
    res.send(`✅ Бот работает! Имя: ${data.result.first_name}`);
  } catch (e) {
    res.send('❌ Ошибка Telegram: ' + e.message);
  }
});

const timers = new Map();

app.post('/set', (req, res) => {
  const { id, chat_id, text, delay } = req.body;
  console.log(`📥 /set → id=${id} | chat=${chat_id} | delay=${delay}сек`);

  if (!id || !chat_id || !text || delay === undefined) {
    console.log('❌ Не все параметры');
    return res.status(400).json({ error: 'Missing params' });
  }

  if (timers.has(id)) clearTimeout(timers.get(id));

  const timer = setTimeout(() => {
    console.log(`⏰ ТАЙМЕР ${id} СРАБОТАЛ! Отправляем...`);
    fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text, parse_mode: 'HTML' })
    })
    .then(r => r.json())
    .then(data => console.log(data.ok ? '✅ Отправлено!' : '❌ Telegram ошибка:', data))
    .catch(err => console.error('❌ Ошибка sendMessage:', err));

    timers.delete(id);
  }, delay * 1000);

  timers.set(id, timer);
  res.json({ status: 'set' });
});

app.post('/cancel', (req, res) => {
  const { id } = req.body;
  console.log(`🛑 /cancel → id=${id}`);
  if (timers.has(id)) {
    clearTimeout(timers.get(id));
    timers.delete(id);
  }
  res.json({ status: 'cancelled' });
});

app.get('/', (req, res) => res.send('✅ GTA Helper Timer Service — работает!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер слушает порт ${PORT}`));
