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
        name TEXT,
        subgroup INTEGER
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        pair_number INTEGER,
        subject TEXT,
        student_name TEXT,
        subgroup INTEGER,
        status TEXT,
        marked_by TEXT
    )`);

    // Полный список пользователей для ИСП-О-25
    const usersList = [
        ['kurator_maria', 'MarP3tr_2026!Pass', 'kurator', 'Мария Петровна', 0],
        ['starosta_artem', 'Art3m_Star_2026#Key', 'starosta', 'Артем', 1],
        ['zam_vasiliy', 'Vas_Zam_2026$Code', 'zam_starosty', 'Василий', 1],
        ['isp25_abbasov_1', 'St_Abbasov_2026!1', 'student', 'Аббасов', 2],
        ['isp25_abramov_2', 'St_Abramov_2026!2', 'student', 'Абрамов', 1],
        ['isp25_artamonova_3', 'St_Artamonova_2026!3', 'student', 'Артамонова', 1],
        ['isp25_balaev_4', 'St_Balaev_2026!4', 'student', 'Балаев', 2],
        ['isp25_berezin_5', 'St_Berezin_2026!5', 'student', 'Березин', 1],
        ['isp25_bogdanov_6', 'St_Bogdanov_2026!6', 'student', 'Богданов', 1],
        ['isp25_borodina_7', 'St_Borodina_2026!7', 'student', 'Бородина', 1],
        ['isp25_buts_8', 'St_Buts_2026!8', 'student', 'Буц', 1],
        ['isp25_velichkin_9', 'St_Velichkin_2026!9', 'student', 'Величкин', 1],
        ['isp25_galichev_10', 'St_Galichev_2026!10', 'student', 'Галичев', 1],
        ['isp25_golikov_11', 'St_Golikov_2026!11', 'student', 'Голиков', 2],
        ['isp25_dmitriev_12', 'St_Dmitriev_2026!12', 'student', 'Дмитриев', 1],
        ['isp25_dmitrieva_13', 'St_Dmitrieva_2026!13', 'student', 'Дмитриева', 1],
        ['isp25_zhukova_14', 'St_Zhukova_2026!14', 'student', 'Жукова', 1],
        ['isp25_zakaraya_15', 'St_Zakaraya_2026!15', 'student', 'Закарая', 2],
        ['isp25_zubakov_16', 'St_Zubakov_2026!16', 'student', 'Зубаков', 1],
        ['isp25_ilyushenkov_17', 'St_Ilyushenkov_2026!17', 'student', 'Ильюшенков', 2],
        ['isp25_kochegura_18', 'St_Kochegura_2026!18', 'student', 'Кочегура', 2],
        ['isp25_larionov_19', 'St_Larionov_2026!19', 'student', 'Ларионов', 1],
        ['isp25_lukicheva_20', 'St_Lukicheva_2026!20', 'student', 'Лукичева', 2],
        ['isp25_nazhuyev_21', 'St_Nazhuyev_2026!21', 'student', 'Нажуев', 2],
        ['isp25_ananchuk_22', 'St_Ananchuk_22', 'student', 'Ананчук', 1],
        ['isp25_arikhipov_23', 'St_Arikhipov_2026!23', 'student', 'Арихипов', 1],
        ['isp25_bikmurzin_24', 'St_Bikmurzin_2026!24', 'student', 'Бикмурзин', 2],
        ['isp25_vitko_25', 'St_Vitko_2026!25', 'student', 'Витько', 2],
        ['isp25_malkhasyan_26', 'St_Malkhasyan_2026!26', 'student', 'Малхасян', 2],
        ['isp25_fatkulina_27', 'St_Fatkulina_2026!27', 'student', 'Фаткулина', 2]
    ];

    usersList.forEach(([username, password, role, name, subgroup]) => {
        db.run(`INSERT INTO users (username, password, role, name, subgroup) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(username) DO UPDATE SET password=excluded.password, role=excluded.role, name=excluded.name, subgroup=excluded.subgroup`, 
            [username, password, role, name, subgroup]);
    });
});

// Авторизация
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT username, role, name, subgroup FROM users WHERE username = ? AND password = ?`, 
        [username, password], (err, row) => {
            if (err) return res.status(500).json({ error: 'Ошибка сервера' });
            if (!row) return res.status(401).json({ error: 'Неверный логин или пароль' });
            res.json({ success: true, user: row });
        });
});

// Получение посещаемости
app.get('/api/attendance', (req, res) => {
    const { date } = req.query;
    db.all(`SELECT * FROM attendance WHERE date = ?`, [date], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Ошибка сервера' });
        res.json(rows);
    });
});

// Сохранение посещаемости (Только Артем и Василий)
app.post('/api/attendance', (req, res) => {
    const { date, pair_number, subject, records, userRole, username } = req.body;

    if (userRole === 'kurator' || userRole === 'student') {
        return res.status(403).json({ error: 'У вас нет прав на редактирование посещаемости!' });
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

app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
