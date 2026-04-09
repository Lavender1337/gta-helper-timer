const express = require('express');
const app = express();

app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ BOT_TOKEN не установлен в Environment Variables!');
  process.exit(1);
}

const timers = new Map(); // храним таймеры

// === Отправка сообщения в Telegram ===
async function sendMessage(chat_id, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat_id,
        text: text,
        parse_mode: 'HTML'
      })
    });
    console.log(`✅ Сообщение отправлено в ${chat_id}`);
  } catch (e) {
    console.error('Ошибка отправки:', e);
  }
}

// === Создать таймер ===
app.post('/set', (req, res) => {
  const { id, chat_id, text, delay } = req.body;   // delay в секундах

  if (!id || !chat_id || !text || delay === undefined) {
    return res.status(400).json({ error: 'Не все параметры переданы' });
  }

  // Если таймер уже есть — отменяем старый
  if (timers.has(id)) {
    clearTimeout(timers.get(id));
  }

  const timerId = setTimeout(() => {
    sendMessage(chat_id, text);
    timers.delete(id);
  }, delay * 1000);

  timers.set(id, timerId);

  console.log(`⏰ Таймер ${id} запущен на ${delay} сек`);
  res.json({ status: 'set' });
});

// === Отменить таймер ===
app.post('/cancel', (req, res) => {
  const { id } = req.body;

  if (timers.has(id)) {
    clearTimeout(timers.get(id));
    timers.delete(id);
    console.log(`🛑 Таймер ${id} отменён`);
  }

  res.json({ status: 'cancelled' });
});

// Проверка, что сервис живой
app.get('/', (req, res) => {
  res.send('✅ GTA Helper Timer Service работает!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});