const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(express.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

const BOT_TOKEN = process.env.BOT_TOKEN;
console.log('🚀 Сервер запущен. BOT_TOKEN:', BOT_TOKEN ? '✅ ЕСТЬ' : '❌ НЕТ');

const TIMERS_FILE = path.join(__dirname, 'timers.json');
let timers = new Map();

function loadTimers() {
    try {
        if (fs.existsSync(TIMERS_FILE)) {
            const data = JSON.parse(fs.readFileSync(TIMERS_FILE, 'utf8'));
            timers = new Map(Object.entries(data));
            console.log(`📦 Загружено ${timers.size} таймеров`);
        }
    } catch (e) {
        console.error('Ошибка загрузки таймеров:', e);
    }
}
function saveTimers() {
    try {
        const obj = Object.fromEntries(timers);
        fs.writeFileSync(TIMERS_FILE, JSON.stringify(obj, null, 2));
    } catch (e) {
        console.error('Ошибка сохранения таймеров:', e);
    }
}

loadTimers();

setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [id, data] of timers.entries()) {
        if (now >= data.endTime) {
            if (data.notify) {
                fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: data.chat_id,
                        text: data.text,
                        parse_mode: 'HTML'
                    })
                }).then(r => r.json())
                  .then(res => console.log(res.ok ? '✅ Уведомление отправлено' : '❌ Ошибка Telegram'))
                  .catch(err => console.error('Ошибка отправки:', err));
            }
            timers.delete(id);
            changed = true;
        }
    }
    if (changed) saveTimers();
}, 5000);

app.post('/set', (req, res) => {
    const { id, chat_id, text, delay, notify = true } = req.body;
    console.log(`📥 /set → id=${id} | delay=${delay} сек | notify=${notify}`);
    if (!id || !chat_id || !text || delay === undefined) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    if (timers.has(id)) timers.delete(id);
    const endTime = Date.now() + delay * 1000;
    timers.set(id, { chat_id, text, endTime, notify });
    saveTimers();
    console.log(`✅ Таймер ${id} сохранён до ${new Date(endTime).toLocaleTimeString()}`);
    res.json({ status: 'set' });
});

app.post('/cancel', (req, res) => {
    const { id } = req.body;
    if (timers.has(id)) {
        timers.delete(id);
        saveTimers();
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
