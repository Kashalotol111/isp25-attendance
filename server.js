const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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
        pair_number INTEGER, -- 1, 2, 3, 4, 5, 6
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

    console.log("Заполнение базы данных пользователями и точным расписанием...");
    
    db.run(`INSERT INTO users (login, password, full_name, role) VALUES ('admin', 'admin123', 'Администратор', 'admin')`);
    db.run(`INSERT INTO users (login, password, full_name, role) VALUES ('kurator', 'kurator123', 'Куратор группы', 'kurator')`);

    const studentsWithSubgroups = [
        { name: "Аббасов Тагир Рамилович", login: "tagir.abbasov", sub: 2 },
        { name: "Абрамов Иван Александрович", login: "ivan.abramov", sub: 1 },
        { name: "Артамонова Ксения Александровна", login: "ksenia.artamonova", sub: 1 },
        { name: "Балаев Али Фуад оглы", login: "ali.balayev", sub: 2 },
        { name: "Березин Родион Романович", login: "rodion.berezin", sub: 1 },
        { name: "Богданов Василий Евгеньевич", login: "vasily.bogdanov", sub: 1 },
        { name: "Бородина Дарья Андреевна", login: "daria.borodina", sub: 1 },
        { name: "Буц Артём Артёмович", login: "artem.buts", sub: 1 },
        { name: "Величкин Илья Евгеньевич", login: "ilya.velichkin", sub: 1 },
        { name: "Галичев Максим Сергеевич", login: "maxim.galichev", sub: 1 },
        { name: "Голиков Ярослав Александрович", login: "yaroslav.golikov", sub: 2 },
        { name: "Дмитриев Леонид Геннадьевич", login: "leonid.dmitriev", sub: 1 },
        { name: "Дмитриева Елизавета Дмитриевна", login: "elizaveta.dmitrieva", sub: 1 },
        { name: "Жукова Алёна Александровна", login: "alyona.zhukova", sub: 1 },
        { name: "Закарая Георгий Звиадович", login: "georgy.zakaraya", sub: 2 },
        { name: "Зубаков Сергей Артемович", login: "sergey.zubakov", sub: 1 },
        { name: "Ильюшенков Дмитрий Сергеевич", login: "dmitry.ilyushenkov", sub: 2 },
        { name: "Кочегура Кирилл Сергеевич", login: "kirill.kochegura", sub: 2 },
        { name: "Ларионов Денис Дмитриевич", login: "denis.larionov", sub: 1 },
        { name: "Лукичева Олеся Александровна", login: "olesya.lukicheva", sub: 2 },
        { name: "Нажуев Абдурахман Ибрагимович", login: "abdurakhman.nazhuyev", sub: 2 },
        { name: "Фаткулина Анастасия Сергеевна", login: "anastasia.fatkulina", sub: 2 },
        { name: "Ананчук Артём", login: "artem.ananchuk", sub: 1 },
        { name: "Архипов Дмитрий Александрович", login: "dmitry.arkhipov", sub: 1 },
        { name: "Бикмурзин Ильдар Маратович", login: "ildar.bikmurzin", sub: 2 },
        { name: "Витько Андрей Сергеевич", login: "andrey.vitko", sub: 2 },
        { name: "Малхасян Сандро Давидович", login: "sandro.malkhasyan", sub: 2 }
    ];

    const stmt = db.prepare(`INSERT INTO users (login, password, full_name, subgroup, role) VALUES (?, 'isp25-pass', ?, ?, 'student')`);
    studentsWithSubgroups.forEach(st => {
        stmt.run(st.login, st.name, st.sub);
    });
    stmt.finalize();

    const scheduleData = [
        // ================= НЕЧЁТНАЯ НЕДЕЛЯ =================
        // Среда
        { week: 'odd', day: 'Среда', pair: 1, start: '8:45', end: '10:15', subj: 'Безопасность жизнедеятельности', type: 'практика', sub: null, room: '202а', teacher: 'Кириллова О.О.' },
        { week: 'odd', day: 'Среда', pair: 2, start: '10:25', end: '11:55', subj: 'Физическая культура', type: 'практика', sub: null, room: 'сп.зал', teacher: 'Грайфер В.Н.' },
        { week: 'odd', day: 'Среда', pair: 3, start: '12:05', end: '14:20', subj: 'Операт.сист.и среды', type: 'лекция', sub: null, room: '319', teacher: 'Моор А.А.' },
        { week: 'odd', day: 'Среда', pair: 4, start: '14:30', end: '16:00', subj: 'МДК 01.01 Техн.разр.прогр.обесп.', type: 'практика', sub: 2, room: '302', teacher: 'Строганова В.А.' },
        { week: 'odd', day: 'Среда', pair: 5, start: '16:10', end: '17:40', subj: 'Информ. технолог.', type: 'практика', sub: 2, room: '302', teacher: 'Строганова В.А.' },

        // Четверг
        { week: 'odd', day: 'Четверг', pair: 2, start: '10:25', end: '11:55', subj: 'МДК 01.01 Техн.разр.прогр.обесп.', type: 'практика', sub: 1, room: '302', teacher: 'Строганова В.А.' },
        { week: 'odd', day: 'Четверг', pair: 3, start: '12:05', end: '14:20', subj: 'МДК.01.02 Инстр.средств. разработки ПО', type: 'практика', sub: 1, room: '319', teacher: 'Попова Т.А.' },
        { week: 'odd', day: 'Четверг', pair: 4, start: '14:30', end: '16:00', subj: 'Основы алгоритмизации и программирования', type: 'лекция', sub: null, room: '315', teacher: 'Журавлева Т.А.' },
        { week: 'odd', day: 'Четверг', pair: 5, start: '16:10', end: '17:40', subj: 'Информ. технолог.', type: 'лекция', sub: null, room: '302', teacher: 'Строганова В.А.' },

        // Пятница
        { week: 'odd', day: 'Пятница', pair: 1, start: '8:45', end: '10:15', subj: 'Осн.филос.', type: 'лекция', sub: null, room: '305', teacher: 'Пересторонина М.Г.' },
        { week: 'odd', day: 'Пятница', pair: 2, start: '10:25', end: '11:55', subj: 'Осн.филос.', type: 'практика', sub: null, room: '305', teacher: 'Пересторонина М.Г.' },
        { week: 'odd', day: 'Пятница', pair: 3, start: '12:05', end: '14:20', subj: 'История', type: 'лекция', sub: null, room: '303', teacher: 'Арзамазов М.Н.' },
        { week: 'odd', day: 'Пятница', pair: 4, start: '14:30', end: '16:00', subj: 'Безопасность жизнедеятельности', type: 'лекция', sub: null, room: '411', teacher: 'Кириллова О.О.' },
        { week: 'odd', day: 'Пятница', pair: 5, start: '16:10', end: '17:40', subj: 'Информ. технолог.', type: 'практика', sub: 1, room: '315', teacher: 'Строганова В.А.' },

        // Суббота
        { week: 'odd', day: 'Суббота', pair: 1, start: '8:45', end: '10:15', subj: 'Операт.сист.и среды', type: 'практика', sub: 1, room: '302', teacher: 'Щукин Е.Ю.' },
        { week: 'odd', day: 'Суббота', pair: 1, start: '8:45', end: '10:15', subj: 'Основы алгоритмизации и программирования', type: 'практика', sub: 2, room: '315', teacher: 'Журавлева Т.А.' },
        { week: 'odd', day: 'Суббота', pair: 2, start: '10:25', end: '11:55', subj: 'Основы алгоритмизации и программирования', type: 'практика', sub: 1, room: '315', teacher: 'Журавлева Т.А.' },
        { week: 'odd', day: 'Суббота', pair: 2, start: '10:25', end: '11:55', subj: 'Операт.сист.и среды', type: 'практика', sub: 2, room: '302', teacher: 'Щукин Е.Ю.' },


        // ================= ЧЁТНАЯ НЕДЕЛЯ =================
        // Понедельник
        { week: 'even', day: 'Понедельник', pair: 1, start: '8:45', end: '10:15', subj: 'МДК.01.02 Инстр.средств. разработки ПО', type: 'практика', sub: 2, room: '308', teacher: 'Попова Т.А.' },
        { week: 'even', day: 'Понедельник', pair: 2, start: '10:25', end: '11:55', subj: 'МДК.01.02 Инстр.средств. разработки ПО', type: 'лекция', sub: null, room: '312', teacher: 'Попова Т.А.' },
        { week: 'even', day: 'Понедельник', pair: 3, start: '12:05', end: '14:20', subj: 'МДК.01.02 Инстр.средств. разработки ПО', type: 'практика', sub: 1, room: '319', teacher: 'Попова Т.А.' },
        { week: 'even', day: 'Понедельник', pair: 4, start: '14:30', end: '16:00', subj: 'МДК.01.02 Инстр.средств. разработки ПО', type: 'практика', sub: 1, room: '319', teacher: 'Попова Т.А.' },

        // Вторник
        { week: 'even', day: 'Вторник', pair: 1, start: '8:45', end: '10:15', subj: 'Информ. технолог.', type: 'практика', sub: 1, room: '319', teacher: 'Строганова В.А.' },
        { week: 'even', day: 'Вторник', pair: 1, start: '8:45', end: '10:15', subj: 'МДК.01.02 Инстр.средств. разработки ПО', type: 'практика', sub: 2, room: '315', teacher: 'Попова Т.А.' },
        { week: 'even', day: 'Вторник', pair: 2, start: '10:25', end: '11:55', subj: 'МДК 01.01 Техн.разр.прогр.обесп.', type: 'практика', sub: 1, room: '319', teacher: 'Строганова В.А.' },
        { week: 'even', day: 'Вторник', pair: 2, start: '10:25', end: '11:55', subj: 'МДК.01.02 Инстр.средств. разработки ПО', type: 'практика', sub: 2, room: '301', teacher: 'Попова Т.А.' },
        { week: 'even', day: 'Вторник', pair: 3, start: '12:05', end: '14:20', subj: 'МДК 01.01 Техн.разр.прогр.обесп.', type: 'лекция', sub: null, room: '319', teacher: 'Строганова В.А.' },
        { week: 'even', day: 'Вторник', pair: 4, start: '14:30', end: '16:00', subj: 'Информ. технолог.', type: 'практика', sub: 2, room: '319', teacher: 'Строганова В.А.' },
        { week: 'even', day: 'Вторник', pair: 5, start: '16:10', end: '17:40', subj: 'МДК 01.01 Техн.разр.прогр.обесп.', type: 'практика', sub: 2, room: '319', teacher: 'Строганова В.А.' },

        // Среда
        { week: 'even', day: 'Среда', pair: 1, start: '8:45', end: '10:15', subj: 'Операт.сист.и среды', type: 'лекция', sub: null, room: '202б', teacher: 'Моор А.А.' },
        { week: 'even', day: 'Среда', pair: 2, start: '10:25', end: '11:55', subj: 'Физическая культура', type: 'практика', sub: null, room: 'сп.зал', teacher: 'Грайфер В.Н.' },
        { week: 'even', day: 'Среда', pair: 3, start: '12:05', end: '14:20', subj: 'Безопасность жизнедеятельности', type: 'практика', sub: null, room: '1', teacher: 'Кириллова О.О.' },
        { week: 'even', day: 'Среда', pair: 4, start: '14:30', end: '16:00', subj: 'Ин.яз. в проф.деят-ти (англ.)', type: 'практика', sub: null, room: '407а', teacher: 'Лебедев В.С.' },
        { week: 'even', day: 'Среда', pair: 5, start: '16:10', end: '17:40', subj: 'Информ. технолог.', type: 'лекция', sub: null, room: '202а', teacher: 'Строганова В.А.' },

        // Пятница
        { week: 'even', day: 'Пятница', pair: 1, start: '8:45', end: '10:15', subj: 'Элемен.высш.матем.', type: 'практика', sub: null, room: '407', teacher: 'Еремина Е.А.' },
        { week: 'even', day: 'Пятница', pair: 2, start: '10:25', end: '11:55', subj: 'Осн.филос.', type: 'лекция', sub: null, room: '202а', teacher: 'Пересторонина М.Г.' },
        { week: 'even', day: 'Пятница', pair: 3, start: '12:05', end: '14:20', subj: 'История', type: 'практика', sub: null, room: '407', teacher: 'Арзамазов М.Н.' },
        { week: 'even', day: 'Пятница', pair: 4, start: '14:30', end: '16:00', subj: 'Элемен.высш.матем.', type: 'лекция', sub: null, room: '305', teacher: 'Еремина Е.А.' },
        { week: 'even', day: 'Пятница', pair: 5, start: '16:10', end: '17:40', subj: 'Ин.яз. в проф.деят-ти (англ.)', type: 'практика', sub: null, room: '407а', teacher: 'Лебедев В.С.' },

        // Суббота
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

app.post('/api/login', (req, res) => {
    const { login, password } = req.body;
    db.get(`SELECT id, login, full_name, subgroup, role FROM users WHERE login = ? AND password = ?`, [login, password], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(401).json({ error: 'Неверный логин или пароль' });
        res.json(row);
    });
});

app.get('/api/students', (req, res) => {
    db.all(`SELECT id, full_name as name, subgroup, login FROM users WHERE role = 'student' ORDER BY full_name`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

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

app.post('/api/schedule', (req, res) => {
    const { week_type, day_of_week, pair_number, start_time, end_time, subject, type, subgroup, room, teacher } = req.body;
    db.run(`INSERT INTO schedule (week_type, day_of_week, pair_number, start_time, end_time, subject, type, subgroup, room, teacher) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [week_type || 'all', day_of_week, parseInt(pair_number) || 1, start_time, end_time, subject, type, subgroup ? parseInt(subgroup) : null, room, teacher],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        }
    );
});

app.get('/api/attendance', (req, res) => {
    const { date, schedule_id } = req.query;
    db.all(`SELECT student_id, comment FROM attendance WHERE date = ? AND schedule_id = ?`, [date, schedule_id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/attendance', (req, res) => {
    const { date, schedule_id, absentees } = req.body;
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

app.get('/api/stats', (req, res) => {
    const query = `
        SELECT 
            u.id as student_id, 
            u.full_name as name, 
            u.subgroup,
            SUM(CASE WHEN s.type = 'лекция' THEN 1 ELSE 0 END) as lecture_absences,
            SUM(CASE WHEN s.type = 'практика' THEN 1 ELSE 0 END) as practice_absences,
            COUNT(a.id) as total_absences
        FROM users u
        LEFT JOIN attendance a ON u.id = a.student_id
        LEFT JOIN schedule s ON a.schedule_id = s.id
        WHERE u.role = 'student'
        GROUP BY u.id
        ORDER BY u.full_name
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});