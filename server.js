const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database(path.join(__dirname, 'attendance.db'), (err) => {
    if (err) console.error('Ошибка БД:', err.message);
    else console.log('База данных успешно подключена.');
});

// Инициализация таблиц
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT,
        name TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        pair_number INTEGER,
        subject TEXT,
        student_name TEXT,
        subgroup INTEGER,
        status TEXT, -- 'present', 'absent_valid', 'absent_invalid'
        marked_by TEXT
    )`);

    // Дефолтные пользователи
    const defaultUsers = [
        ['kurator', 'kurator2026', 'kurator', 'Куратор группы'],
        ['starosta', 'starosta2026', 'starosta', 'Староста группы'],
        ['zam_starosty', 'zam2026', 'zam_starosty', 'Зам. старосты']
    ];

    defaultUsers.forEach(([username, password, role, name]) => {
        db.run(`INSERT OR IGNORE INTO users (username, password, role, name) VALUES (?, ?, ?, ?)`, 
            [username, password, role, name]);
    });
});

// API Авторизации
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT username, role, name FROM users WHERE username = ? AND password = ?`, 
        [username, password], (err, row) => {
            if (err) return res.status(500).json({ error: 'Ошибка сервера' });
            if (!row) return res.status(401).json({ error: 'Неверный логин или пароль' });
            res.json({ success: true, user: row });
        });
});

// API Получения посещаемости на дату
app.get('/api/attendance', (req, res) => {
    const { date } = req.query;
    db.all(`SELECT * FROM attendance WHERE date = ?`, [date], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Ошибка получения данных' });
        res.json(rows);
    });
});

// API Сохранения посещаемости (Только для старосты и зам. старосты)
app.post('/api/attendance', (req, res) => {
    const { date, pair_number, subject, records, userRole, username } = req.body;

    if (userRole === 'kurator') {
        return res.status(403).json({ error: 'У куратора только режим просмотра!' });
    }

    db.serialize(() => {
        const stmt = db.prepare(`INSERT OR REPLACE INTO attendance 
            (date, pair_number, subject, student_name, subgroup, status, marked_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`);

        records.forEach(r => {
            stmt.run([date, pair_number, subject, r.student_name, r.subgroup, r.status, username]);
        });
        stmt.finalize();
        res.json({ success: true });
    });
});

// API Статистики (Аналитика)
app.get('/api/stats', (req, res) => {
    db.all(`SELECT status, COUNT(*) as count FROM attendance GROUP BY status`, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Ошибка сервера' });
        res.json(rows);
    });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
