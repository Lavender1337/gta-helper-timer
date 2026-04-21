const express = require('express');
const { Redis } = require('@upstash/redis');
const app = express();
app.use(express.json());

// Настройка CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

const BOT_TOKEN = process.env.BOT_TOKEN;
console.log('🚀 Сервер запущен. BOT_TOKEN:', BOT_TOKEN ? '✅ ЕСТЬ' : '❌ НЕТ');

// Подключение к облаку Upstash
const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

let timers = new Map();

// Функция загрузки таймеров из облака
async function loadTimers() {
    try {
        const data = await redis.get('gta_timers_v22');
        if (data) {
            timers = new Map(Object.entries(data));
            console.log(`📦 Загружено ${timers.size} таймеров из Upstash Redis`);
        } else {
            console.log(`📦 База таймеров пуста, создаем новую.`);
        }
    } catch (e) {
        console.error('Ошибка загрузки таймеров из Redis:', e);
    }
}

// Функция сохранения таймеров в облако
async function saveTimers() {
    try {
        const obj = Object.fromEntries(timers);
        await redis.set('gta_timers_v22', obj);
    } catch (e) {
        console.error('Ошибка сохранения таймеров в Redis:', e);
    }
}

// Загружаем таймеры при старте сервера
loadTimers();

// Цикл проверки таймеров (каждые 5 секунд)
setInterval(async () => {
    const now = Date.now();
    let changed = false;

    for (const [id, data] of timers.entries()) {
        if (now >= data.endTime) {
            if (data.notify) {
                try {
                    const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: data.chat_id,
                            text: data.text,
                            parse_mode: 'HTML'
                        })
                    });
                    const res = await r.json();
                    console.log(res.ok ? `✅ Уведомление отправлено (ID: ${id})` : `❌ Ошибка Telegram: ${res.description}`);
                    
                    // Пауза 200мс, чтобы Telegram не заблокировал бота за спам, если кончилось много таймеров сразу
                    await new Promise(resolve => setTimeout(resolve, 200));
                } catch (err) {
                    console.error('Ошибка отправки уведомления:', err);
                }
            }
            timers.delete(id);
            changed = true;
        }
    }

    if (changed) {
        await saveTimers();
    }
}, 5000);

// Эндпоинт установки нового таймера
app.post('/set', async (req, res) => {
    const { id, chat_id, text, delay, notify = true } = req.body;
    console.log(`📥 /set → id=${id} | delay=${delay} сек | notify=${notify}`);
    
    if (!id || !chat_id || !text || delay === undefined) {
        return res.status(400).json({ error: 'Missing parameters' });
    }
    
    if (timers.has(id)) timers.delete(id);
    const endTime = Date.now() + delay * 1000;
    timers.set(id, { chat_id, text, endTime, notify });
    
    await saveTimers(); // Ждем сохранения в облако
    console.log(`✅ Таймер ${id} сохранён до ${new Date(endTime).toLocaleTimeString()}`);
    res.json({ status: 'set' });
});

// Эндпоинт отмены таймера
app.post('/cancel', async (req, res) => {
    const { id } = req.body;
    if (timers.has(id)) {
        timers.delete(id);
        await saveTimers(); // Ждем удаления из облака
        console.log(`🛑 Таймер ${id} отменён`);
    }
    res.json({ status: 'cancelled' });
});

// Базовые эндпоинты для проверки
app.get('/', (req, res) => res.send('✅ GTA Helper Timer Service — работает на облаке Redis!'));

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
