const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const dbFile = path.join(__dirname, 'attendance.db');
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) console.error('Ошибка подключения к БД:', err.message);
    else console.log('Подключено к базе данных SQLite.');
});

db.serialize(() => {
    db.run(`DROP TABLE IF EXISTS attendance`);
    db.run(`DROP TABLE IF EXISTS schedule`);
    db.run(`DROP TABLE IF EXISTS users`);

    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        login TEXT UNIQUE,
        password TEXT,
        full_name TEXT,
        subgroup INTEGER,
        role TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        week_type TEXT, -- 'odd', 'even'
        day_of_week TEXT,
        pair_number INTEGER,
        start_time TEXT,
        end_time TEXT,
        subject TEXT,
        type TEXT, -- 'лекция', 'практика'
        subgroup INTEGER, -- NULL, 1, 2
        room TEXT,
        teacher TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        schedule_id INTEGER,
        student_id INTEGER,
        comment TEXT,
        UNIQUE(date, schedule_id, student_id)
    )`);

    console.log("Заполнение базы данных пользователями и расписанием...");

    // Системные роли
    db.run(`INSERT INTO users (login, password, full_name, subgroup, role) VALUES ('kurator_maria', 'MarP3tr_2026!Pass', 'Мария Петровна (Куратор)', 0, 'kurator')`);
    db.run(`INSERT INTO users (login, password, full_name, subgroup, role) VALUES ('starosta_artem', 'Art3m_Star_2026#Key', 'Артем (Староста)', 1, 'starosta')`);
    db.run(`INSERT INTO users (login, password, full_name, subgroup, role) VALUES ('zam_vasiliy', 'Vas_Zam_2026$Code', 'Василий (Зам. старосты)', 1, 'zam_starosty')`);

    // Студенты из Студенты.xlsx
    const studentsWithSubgroups = [
        { name: "Аббасов", login: "isp25_abbasov_1", sub: 2 },
        { name: "Абрамов", login: "isp25_abramov_2", sub: 1 },
        { name: "Артамонова", login: "isp25_artamonova_3", sub: 1 },
        { name: "Балаев", login: "isp25_balaev_4", sub: 2 },
        { name: "Березин", login: "isp25_berezin_5", sub: 1 },
        { name: "Богданов", login: "isp25_bogdanov_6", sub: 1 },
        { name: "Бородина", login: "isp25_borodina_7", sub: 1 },
        { name: "Буц", login: "isp25_buts_8", sub: 1 },
        { name: "Величкин", login: "isp25_velichkin_9", sub: 1 },
        { name: "Галичев", login: "isp25_galichev_10", sub: 1 },
        { name: "Голиков", login: "isp25_golikov_11", sub: 2 },
        { name: "Дмитриев", login: "isp25_dmitriev_12", sub: 1 },
        { name: "Дмитриева", login: "isp25_dmitrieva_13", sub: 1 },
        { name: "Жукова", login: "isp25_zhukova_14", sub: 1 },
        { name: "Закарая", login: "isp25_zakaraya_15", sub: 2 },
        { name: "Зубаков", login: "isp25_zubakov_16", sub: 1 },
        { name: "Ильюшенков", login: "isp25_ilyushenkov_17", sub: 2 },
        { name: "Кочегура", login: "isp25_kochegura_18", sub: 2 },
        { name: "Ларионов", login: "isp25_larionov_19", sub: 1 },
        { name: "Лукичева", login: "isp25_lukicheva_20", sub: 2 },
        { name: "Нажуев", login: "isp25_nazhuyev_21", sub: 2 },
        { name: "Ананчук", login: "isp25_ananchuk_22", sub: 1 },
        { name: "Арихипов", login: "isp25_arikhipov_23", sub: 1 },
        { name: "Бикмурзин", login: "isp25_bikmurzin_24", sub: 2 },
        { name: "Витько", login: "isp25_vitko_25", sub: 2 },
        { name: "Малхасян", login: "isp25_malkhasyan_26", sub: 2 },
        { name: "Фаткулина", login: "isp25_fatkulina_27", sub: 2 }
    ];

    const stmt = db.prepare(`INSERT INTO users (login, password, full_name, subgroup, role) VALUES (?, ?, ?, ?, 'student')`);
    studentsWithSubgroups.forEach((st, idx) => {
        let base = st.login.split('_')[1];
        let pass = `St_${base.charAt(0).toUpperCase() + base.slice(1)}_2026!${idx+1}`;
        stmt.run(st.login, pass, st.name, st.sub);
    });
    stmt.finalize();

    // Расписание пар
    const scheduleData = [
        { week: 'odd', day: 'Среда', pair: 1, start: '8:45', end: '10:15', subj: 'Безопасность жизнедеятельности', type: 'практика', sub: null, room: '202а', teacher: 'Кириллова О.О.' },
        { week: 'odd', day: 'Среда', pair: 2, start: '10:25', end: '11:55', subj: 'Физическая культура', type: 'практика', sub: null, room: 'сп.зал', teacher: 'Грайфер В.Н.' },
        { week: 'odd', day: 'Среда', pair: 3, start: '12:05', end: '14:20', subj: 'Операт.сист.и среды', type: 'лекция', sub: null, room: '319', teacher: 'Моор А.А.' },
        { week: 'odd', day: 'Среда', pair: 4, start: '14:30', end: '16:00', subj: 'МДК 01.01 Техн.разр.прогр.обесп.', type: 'практика', sub: 2, room: '302', teacher: 'Строганова В.А.' },
        { week: 'odd', day: 'Среда', pair: 5, start: '16:10', end: '17:40', subj: 'Информ. технолог.', type: 'практика', sub: 2, room: '302', teacher: 'Строганова В.А.' },

        { week: 'odd', day: 'Четверг', pair: 2, start: '10:25', end: '11:55', subj: 'МДК 01.01 Техн.разр.прогр.обесп.', type: 'практика', sub: 1, room: '302', teacher: 'Строганова В.А.' },
        { week: 'odd', day: 'Четверг', pair: 3, start: '12:05', end: '14:20', subj: 'МДК.01.02 Инстр.средств. разработки ПО', type: 'практика', sub: 1, room: '319', teacher: 'Попова Т.А.' },
        { week: 'odd', day: 'Четверг', pair: 4, start: '14:30', end: '16:00', subj: 'Основы алгоритмизации и программирования', type: 'лекция', sub: null, room: '315', teacher: 'Журавлева Т.А.' },
        { week: 'odd', day: 'Четверг', pair: 5, start: '16:10', end: '17:40', subj: 'Информ. технолог.', type: 'лекция', sub: null, room: '302', teacher: 'Строганова В.А.' },

        { week: 'odd', day: 'Пятница', pair: 1, start: '8:45', end: '10:15', subj: 'Осн.филос.', type: 'лекция', sub: null, room: '305', teacher: 'Пересторонина М.Г.' },
        { week: 'odd', day: 'Пятница', pair: 2, start: '10:25', end: '11:55', subj: 'Осн.филос.', type: 'практика', sub: null, room: '305', teacher: 'Пересторонина М.Г.' },
        { week: 'odd', day: 'Пятница', pair: 3, start: '12:05', end: '14:20', subj: 'История', type: 'лекция', sub: null, room: '303', teacher: 'Арзамазов М.Н.' },
        { week: 'odd', day: 'Пятница', pair: 4, start: '14:30', end: '16:00', subj: 'Безопасность жизнедеятельности', type: 'лекция', sub: null, room: '411', teacher: 'Кириллова О.О.' },
        { week: 'odd', day: 'Пятница', pair: 5, start: '16:10', end: '17:40', subj: 'Информ. технолог.', type: 'практика', sub: 1, room: '315', teacher: 'Строганова В.А.' },

        { week: 'odd', day: 'Суббота', pair: 1, start: '8:45', end: '10:15', subj: 'Операт.сист.и среды', type: 'практика', sub: 1, room: '302', teacher: 'Щукин Е.Ю.' },
        { week: 'odd', day: 'Суббота', pair: 1, start: '8:45', end: '10:15', subj: 'Основы алгоритмизации и программирования', type: 'практика', sub: 2, room: '315', teacher: 'Журавлева Т.А.' },
        { week: 'odd', day: 'Суббота', pair: 2, start: '10:25', end: '11:55', subj: 'Основы алгоритмизации и программирования', type: 'практика', sub: 1, room: '315', teacher: 'Журавлева Т.А.' },
        { week: 'odd', day: 'Суббота', pair: 2, start: '10:25', end: '11:55', subj: 'Операт.сист.и среды', type: 'практика', sub: 2, room: '302', teacher: 'Щукин Е.Ю.' },

        { week: 'even', day: 'Понедельник', pair: 1, start: '8:45', end: '10:15', subj: 'МДК.01.02 Инстр.средств. разработки ПО', type: 'практика', sub: 2, room: '308', teacher: 'Попова Т.А.' },
        { week: 'even', day: 'Понедельник', pair: 2, start: '10:25', end: '11:55', subj: 'МДК.01.02 Инстр.средств. разработки ПО', type: 'лекция', sub: null, room: '312', teacher: 'Попова Т.А.' },
        { week: 'even', day: 'Понедельник', pair: 3, start: '12:05', end: '14:20', subj: 'МДК.01.02 Инстр.средств. разработки ПО', type: 'практика', sub: 1, room: '319', teacher: 'Попова Т.А.' },
        { week: 'even', day: 'Понедельник', pair: 4, start: '14:30', end: '16:00', subj: 'МДК.01.02 Инстр.средств. разработки ПО', type: 'практика', sub: 1, room: '319', teacher: 'Попова Т.А.' },

        { week: 'even', day: 'Вторник', pair: 1, start: '8:45', end: '10:15', subj: 'Информ. технолог.', type: 'практика', sub: 1, room: '319', teacher: 'Строганова В.А.' },
        { week: 'even', day: 'Вторник', pair: 1, start: '8:45', end: '10:15', subj: 'МДК.01.02 Инстр.средств. разработки ПО', type: 'практика', sub: 2, room: '315', teacher: 'Попова Т.А.' },
        { week: 'even', day: 'Вторник', pair: 2, start: '10:25', end: '11:55', subj: 'МДК 01.01 Техн.разр.прогр.обесп.', type: 'практика', sub: 1, room: '319', teacher: 'Строганова В.А.' },
        { week: 'even', day: 'Вторник', pair: 2, start: '10:25', end: '11:55', subj: 'МДК.01.02 Инстр.средств. разработки ПО', type: 'практика', sub: 2, room: '301', teacher: 'Попова Т.А.' },
        { week: 'even', day: 'Вторник', pair: 3, start: '12:05', end: '14:20', subj: 'МДК 01.01 Техн.разр.прогр.обесп.', type: 'лекция', sub: null, room: '319', teacher: 'Строганова В.А.' },
        { week: 'even', day: 'Вторник', pair: 4, start: '14:30', end: '16:00', subj: 'Информ. технолог.', type: 'практика', sub: 2, room: '319', teacher: 'Строганова В.А.' },
        { week: 'even', day: 'Вторник', pair: 5, start: '16:10', end: '17:40', subj: 'МДК 01.01 Техн.разр.прогр.обесп.', type: 'практика', sub: 2, room: '319', teacher: 'Строганова В.А.' },

        { week: 'even', day: 'Среда', pair: 1, start: '8:45', end: '10:15', subj: 'Операт.сист.и среды', type: 'лекция', sub: null, room: '202б', teacher: 'Моор А.А.' },
        { week: 'even', day: 'Среда', pair: 2, start: '10:25', end: '11:55', subj: 'Физическая культура', type: 'практика', sub: null, room: 'сп.зал', teacher: 'Грайфер В.Н.' },
        { week: 'even', day: 'Среда', pair: 3, start: '12:05', end: '14:20', subj: 'Безопасность жизнедеятельности', type: 'практика', sub: null, room: '1', teacher: 'Кириллова О.О.' },
        { week: 'even', day: 'Среда', pair: 4, start: '14:30', end: '16:00', subj: 'Ин.яз. в проф.деят-ти (англ.)', type: 'практика', sub: null, room: '407а', teacher: 'Лебедев В.С.' },
        { week: 'even', day: 'Среда', pair: 5, start: '16:10', end: '17:40', subj: 'Информ. технолог.', type: 'лекция', sub: null, room: '202а', teacher: 'Строганова В.А.' },

        { week: 'even', day: 'Пятница', pair: 1, start: '8:45', end: '10:15', subj: 'Элемен.высш.матем.', type: 'практика', sub: null, room: '407', teacher: 'Еремина Е.А.' },
        { week: 'even', day: 'Пятница', pair: 2, start: '10:25', end: '11:55', subj: 'Осн.филос.', type: 'лекция', sub: null, room: '202а', teacher: 'Пересторонина М.Г.' },
        { week: 'even', day: 'Пятница', pair: 3, start: '12:05', end: '14:20', subj: 'История', type: 'практика', sub: null, room: '407', teacher: 'Арзамазов М.Н.' },
        { week: 'even', day: 'Пятница', pair: 4, start: '14:30', end: '16:00', subj: 'Элемен.высш.матем.', type: 'лекция', sub: null, room: '305', teacher: 'Еремина Е.А.' },
        { week: 'even', day: 'Пятница', pair: 5, start: '16:10', end: '17:40', subj: 'Ин.яз. в проф.деят-ти (англ.)', type: 'практика', sub: null, room: '407а', teacher: 'Лебедев В.С.' },

        { week: 'even', day: 'Суббота', pair: 1, start: '8:45', end: '10:15', subj: 'Операт.сист.и среды', type: 'практика', sub: 1, room: '302', teacher: 'Щукин Е.Ю.' },
        { week: 'even', day: 'Суббота', pair: 1, start: '8:45', end: '10:15', subj: 'Основы алгоритмизации и программирования', type: 'практика', sub: 2, room: '315', teacher: 'Журавлева Т.А.' },
        { week: 'even', day: 'Суббота', pair: 2, start: '10:25', end: '11:55', subj: 'Основы алгоритмизации и программирования', type: 'практика', sub: 1, room: '315', teacher: 'Журавлева Т.А.' },
        { week: 'even', day: 'Суббота', pair: 2, start: '10:25', end: '11:55', subj: 'Операт.сист.и среды', type: 'практика', sub: 2, room: '302', teacher: 'Щукин Е.Ю.' }
    ];

    const schStmt = db.prepare(`INSERT INTO schedule (week_type, day_of_week, pair_number, start_time, end_time, subject, type, subgroup, room, teacher) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    scheduleData.forEach(s => {
        schStmt.run(s.week, s.day, s.pair, s.start, s.end, s.subj, s.type, s.sub, s.room, s.teacher);
    });
    schStmt.finalize();
});

// API Авторизации
app.post('/api/login', (req, res) => {
    const { login, password } = req.body;
    db.get(`SELECT id, login, full_name, subgroup, role FROM users WHERE login = ? AND password = ?`, [login, password], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(401).json({ error: 'Неверный логин или пароль' });
        res.json(row);
    });
});

// API Получения списка студентов
app.get('/api/students', (req, res) => {
    db.all(`SELECT id, full_name as name, subgroup, login FROM users WHERE role = 'student' ORDER BY full_name`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// API Расписания
app.get('/api/schedule', (req, res) => {
    db.all(`SELECT * FROM schedule ORDER BY CASE day_of_week 
        WHEN 'Понедельник' THEN 1 
        WHEN 'Вторник' THEN 2 
        WHEN 'Среда' THEN 3 
        WHEN 'Четверг' THEN 4 
        WHEN 'Пятница' THEN 5 
        WHEN 'Суббота' THEN 6 
        ELSE 7 END, pair_number, subgroup`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// API Получения посещаемости
app.get('/api/attendance', (req, res) => {
    const { date, schedule_id } = req.query;
    db.all(`SELECT student_id, comment FROM attendance WHERE date = ? AND schedule_id = ?`, [date, schedule_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// API Сохранения посещаемости (только староста и зам)
app.post('/api/attendance', (req, res) => {
    const { date, schedule_id, absentees, userRole } = req.body;
    if (userRole === 'kurator' || userRole === 'student') {
        return res.status(403).json({ error: 'У вас нет прав на редактирование посещаемости!' });
    }
    db.serialize(() => {
        db.run(`DELETE FROM attendance WHERE date = ? AND schedule_id = ?`, [date, schedule_id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            const stmt = db.prepare(`INSERT INTO attendance (date, schedule_id, student_id, comment) VALUES (?, ?, ?, ?)`);
            absentees.forEach(item => {
                stmt.run(date, schedule_id, item.student_id, item.comment || '');
            });
            stmt.finalize();
            res.json({ success: true });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
