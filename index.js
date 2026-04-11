const express = require('express');
const app = express();
app.use(express.json());

// CORS для Telegram Mini App
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const BOT_TOKEN = process.env.BOT_TOKEN;
console.log('🚀 Сервер запущен. BOT_TOKEN:', BOT_TOKEN ? '✅ ЕСТЬ' : '❌ НЕТ');

// Хранилище таймеров (id → {chat_id, text, endTime})
const timers = new Map();

// Проверка каждые 10 секунд — какие таймеры уже должны сработать
setInterval(() => {
  const now = Date.now();
  for (const [id, data] of timers.entries()) {
    if (now >= data.endTime) {
      console.log(`⏰ ТАЙМЕР ${id} СРАБОТАЛ!`);
      
      fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: data.chat_id,
          text: data.text,
          parse_mode: 'HTML'
        })
      })
      .then(r => r.json())
      .then(res => console.log(res.ok ? '✅ Уведомление отправлено' : '❌ Ошибка Telegram'))
      .catch(err => console.error('Ошибка отправки:', err));

      timers.delete(id);
    }
  }
}, 10000);   // проверка каждые 10 секунд

// === ЭНДПОИНТЫ ===
app.post('/set', (req, res) => {
  const { id, chat_id, text, delay } = req.body;
  console.log(`📥 /set → id=${id} | delay=${delay} сек`);

  if (!id || !chat_id || !text || delay === undefined) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  // Удаляем старый таймер, если был
  if (timers.has(id)) timers.delete(id);

  const endTime = Date.now() + delay * 1000;

  timers.set(id, { chat_id, text, endTime });
  console.log(`✅ Таймер ${id} сохранён до ${new Date(endTime).toLocaleTimeString()}`);

  res.json({ status: 'set' });
});

app.post('/cancel', (req, res) => {
  const { id } = req.body;
  if (timers.has(id)) {
    timers.delete(id);
    console.log(`🛑 Таймер ${id} отменён`);
  }
  res.json({ status: 'cancelled' });
});

app.get('/', (req, res) => res.send('✅ GTA Helper Timer Service — работает!'));

app.get('/test-bot', async (req, res) => {
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`);
    const data = await r.json();
    res.send(`✅ Бот работает! Имя: ${data.result.first_name}`);
  } catch (e) {
    res.send('❌ Ошибка: ' + e.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер слушает порт ${PORT}`));
