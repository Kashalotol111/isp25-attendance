const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Подключение к облачной базе данных PostgreSQL (Neon)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Адаптер совместимости для запросов
const db = {
    serialize: (callback) => { callback(); },
    run: async (sql, params = [], callback) => {
        try {
            let i = 0;
            let pgSql = sql.replace(/\?/g, () => `$${++i}`);
            const res = await pool.query(pgSql, Array.isArray(params) ? params : []);
            if (typeof callback === 'function') callback.call({ lastID: res.rows[0]?.id }, null);
        } catch (err) {
            console.error('DB Error (run):', err.message);
            if (typeof callback === 'function') callback(err);
        }
    },
    all: async (sql, params = [], callback) => {
        try {
            let i = 0;
            let pgSql = sql.replace(/\?/g, () => `$${++i}`);
            const res = await pool.query(pgSql, Array.isArray(params) ? params : []);
            if (typeof callback === 'function') callback(null, res.rows);
        } catch (err) {
            console.error('DB Error (all):', err.message);
            if (typeof callback === 'function') callback(err);
        }
    },
    get: async (sql, params = [], callback) => {
        try {
            let i = 0;
            let pgSql = sql.replace(/\?/g, () => `$${++i}`);
            const res = await pool.query(pgSql, Array.isArray(params) ? params : []);
            if (typeof callback === 'function') callback(null, res.rows[0]);
        } catch (err) {
            console.error('DB Error (get):', err.message);
            if (typeof callback === 'function') callback(err);
        }
    },
    prepare: (sql) => {
        return {
            run: async (...args) => {
                let callback = typeof args[args.length - 1] === 'function' ? args.pop() : null;
                let params = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
                try {
                    let i = 0;
                    let pgSql = sql.replace(/\?/g, () => `$${++i}`);
                    await pool.query(pgSql, params);
                    if (callback) callback(null);
                } catch (err) {
                    console.error('DB Error (prepare.run):', err.message);
                    if (callback) callback(err);
                }
            },
            finalize: () => {}
        };
    }
};

// Инициализация таблиц для PostgreSQL
async function initDB() {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        login TEXT UNIQUE,
        password TEXT,
        full_name TEXT,
        subgroup INTEGER,
        role TEXT
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS schedule (
        id SERIAL PRIMARY KEY,
        week_type TEXT, 
        day_of_week TEXT,
        pair_number INTEGER,
        start_time TEXT,
        end_time TEXT,
        subject TEXT,
        type TEXT,
        subgroup INTEGER,
        room TEXT,
        teacher TEXT,
        is_cancelled INTEGER DEFAULT 0,
        homework TEXT DEFAULT ''
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        date TEXT,
        schedule_id INTEGER,
        student_id INTEGER,
        status TEXT, 
        comment TEXT,
        CONSTRAINT unique_attendance UNIQUE(date, schedule_id, student_id)
    )`);

    const userCheck = await pool.query(`SELECT COUNT(*) as count FROM users`);
    if (parseInt(userCheck.rows[0].count) === 0) {
        console.log('Инициализация начальных данных в облачной БД Neon...');

        await pool.query(`INSERT INTO users (login, password, full_name, subgroup, role) VALUES ('starosta_artem', 'Art3m_Star_2026#Key', 'Артем (Староста)', 1, 'admin')`);
        await pool.query(`INSERT INTO users (login, password, full_name, subgroup, role) VALUES ('zam_vasiliy', 'Vas_Zam_2026$Code', 'Василий (Зам. старосты)', 1, 'admin')`);
        await pool.query(`INSERT INTO users (login, password, full_name, subgroup, role) VALUES ('kurator_maria', 'MarP3tr_2026!Pass', 'Мария Петровна (Куратор)', 0, 'kurator')`);

        const students = [
            { name: "Аббасов", login: "tagir.abbasov", sub: 2 },
            { name: "Абрамов", login: "ivan.abramov", sub: 1 },
            { name: "Артамонова", login: "ksenia.artamonova", sub: 1 },
            { name: "Балаев", login: "ali.balayev", sub: 2 },
            { name: "Березин", login: "rodion.berezin", sub: 1 },
            { name: "Богданов", login: "vasily.bogdanov", sub: 1 },
            { name: "Бородина", login: "daria.borodina", sub: 1 },
            { name: "Буц", login: "artem.buts", sub: 1 },
            { name: "Величкин", login: "ilya.velichkin", sub: 1 },
            { name: "Галичев", login: "maxim.galichev", sub: 1 },
            { name: "Голиков", login: "yaroslav.golikov", sub: 2 },
            { name: "Дмитриев", login: "leonid.dmitriev", sub: 1 },
            { name: "Дмитриева", login: "elizaveta.dmitrieva", sub: 1 },
            { name: "Жукова", login: "alyona.zhukova", sub: 1 },
            { name: "Закарая", login: "georgy.zakaraya", sub: 2 },
            { name: "Зубаков", login: "sergey.zubakov", sub: 1 },
            { name: "Ильюшенков", login: "dmitry.ilyushenkov", sub: 2 },
            { name: "Кочегура", login: "kirill.kochegura", sub: 2 },
            { name: "Ларионов", login: "denis.larionov", sub: 1 },
            { name: "Лукичева", login: "olesya.lukicheva", sub: 2 },
            { name: "Нажуев", login: "abdurakhman.nazhuyev", sub: 2 },
            { name: "Фаткулина", login: "anastasia.fatkulina", sub: 2 },
            { name: "Ананчук", login: "artem.ananchuk", sub: 1 },
            { name: "Архипов", login: "dmitry.arkhipov", sub: 1 },
            { name: "Бикмурзин", login: "ildar.bikmurzin", sub: 2 },
            { name: "Витько", login: "andrey.vitko", sub: 2 },
            { name: "Малхасян", login: "sandro.malkhasyan", sub: 2 }
        ];

        for (const st of students) {
            await pool.query(`INSERT INTO users (login, password, full_name, subgroup, role) VALUES ($1, 'isp25-pass', $2, $3, 'student')`, [st.login, st.name, st.sub]);
        }

        const scheduleData = [
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

            { week: 'odd', day: 'Среда', pair: 1, start: '8:45', end: '10:15', subj: 'Безопасность жизнедеятельности', type: 'практика', sub: null, room: '202а', teacher: 'Кириллова О.О.' },
            { week: 'odd', day: 'Среда', pair: 2, start: '10:25', end: '11:55', subj: 'Физическая культура', type: 'практика', sub: null, room: 'сп.зал', teacher: 'Грайфер В.Н.' },
            { week: 'odd', day: 'Среда', pair: 3, start: '12:05', end: '14:20', subj: 'Операт.сист.и среды', type: 'лекция', sub: null, room: '319', teacher: 'Моор А.А.' },
            { week: 'odd', day: 'Среда', pair: 4, start: '14:30', end: '16:00', subj: 'МДК 01.01 Техн.разр.прогр.обесп.', type: 'практика', sub: 2, room: '302', teacher: 'Строганова В.А.' },
            { week: 'odd', day: 'Среда', pair: 5, start: '16:10', end: '17:40', subj: 'Информ. технолог.', type: 'практика', sub: 2, room: '302', teacher: 'Строганова В.А.' },

            { week: 'even', day: 'Среда', pair: 1, start: '8:45', end: '10:15', subj: 'Операт.сист.и среды', type: 'лекция', sub: null, room: '202б', teacher: 'Моор А.А.' },
            { week: 'even', day: 'Среда', pair: 2, start: '10:25', end: '11:55', subj: 'Физическая культура', type: 'практика', sub: null, room: 'сп.зал', teacher: 'Грайфер В.Н.' },
            { week: 'even', day: 'Среда', pair: 3, start: '12:05', end: '14:20', subj: 'Безопасность жизнедеятельности', type: 'практика', sub: null, room: '1', teacher: 'Кириллова О.О.' },
            { week: 'even', day: 'Среда', pair: 4, start: '14:30', end: '16:00', subj: 'Ин.яз. в проф.деят-ти (англ.)', type: 'практика', sub: null, room: '407а', teacher: 'Лебедев В.С.' },
            { week: 'even', day: 'Среда', pair: 5, start: '16:10', end: '17:40', subj: 'Информ. технолог.', type: 'лекция', sub: null, room: '202а', teacher: 'Строганова В.А.' },

            { week: 'odd', day: 'Четверг', pair: 2, start: '10:25', end: '11:55', subj: 'МДК 01.01 Техн.разр.прогр.обесп.', type: 'практика', sub: 1, room: '302', teacher: 'Строганова В.А.' },
            { week: 'odd', day: 'Четверг', pair: 3, start: '12:05', end: '14:20', subj: 'МДК.01.02 Инстр.средств. разработки ПО', type: 'практика', sub: 1, room: '319', teacher: 'Попова Т.А.' },
            { week: 'odd', day: 'Четверг', pair: 4, start: '14:30', end: '16:00', subj: 'Основы алгоритмизации и программирования', type: 'лекция', sub: null, room: '315', teacher: 'Журавлева Т.А.' },
            { week: 'odd', day: 'Четверг', pair: 5, start: '16:10', end: '17:40', subj: 'Информ. технолог.', type: 'лекция', sub: null, room: '302', teacher: 'Строганова В.А.' },

            { week: 'odd', day: 'Пятница', pair: 1, start: '8:45', end: '10:15', subj: 'Осн.филос.', type: 'лекция', sub: null, room: '305', teacher: 'Пересторонина М.Г.' },
            { week: 'odd', day: 'Пятница', pair: 2, start: '10:25', end: '11:55', subj: 'Осн.филос.', type: 'практика', sub: null, room: '305', teacher: 'Пересторонина М.Г.' },
            { week: 'odd', day: 'Пятница', pair: 3, start: '12:05', end: '14:20', subj: 'История', type: 'лекция', sub: null, room: '303', teacher: 'Арзамазов М.Н.' },
            { week: 'odd', day: 'Пятница', pair: 4, start: '14:30', end: '16:00', subj: 'Безопасность жизнедеятельности', type: 'лекция', sub: null, room: '411', teacher: 'Кириллова О.О.' },
            { week: 'odd', day: 'Пятница', pair: 5, start: '16:10', end: '17:40', subj: 'Информ. технолог.', type: 'практика', sub: 1, room: '315', teacher: 'Строганова В.А.' },

            { week: 'even', day: 'Пятница', pair: 1, start: '8:45', end: '10:15', subj: 'Элемен.высш.матем.', type: 'практика', sub: null, room: '407', teacher: 'Еремина Е.А.' },
            { week: 'even', day: 'Пятница', pair: 2, start: '10:25', end: '11:55', subj: 'Осн.филос.', type: 'лекция', sub: null, room: '202а', teacher: 'Пересторонина М.Г.' },
            { week: 'even', day: 'Пятница', pair: 3, start: '12:05', end: '14:20', subj: 'История', type: 'практика', sub: null, room: '407', teacher: 'Арзамазов М.Н.' },
            { week: 'even', day: 'Пятница', pair: 4, start: '14:30', end: '16:00', subj: 'Элемен.высш.матем.', type: 'лекция', sub: null, room: '305', teacher: 'Еремина Е.А.' },
            { week: 'even', day: 'Пятница', pair: 5, start: '16:10', end: '17:40', subj: 'Ин.яз. в проф.деят-ти (англ.)', type: 'практика', sub: null, room: '407а', teacher: 'Лебедев В.С.' },

            { week: 'odd', day: 'Суббота', pair: 1, start: '8:45', end: '10:15', subj: 'Операт.сист.и среды', type: 'практика', sub: 1, room: '302', teacher: 'Щукин Е.Ю.' },
            { week: 'odd', day: 'Суббота', pair: 1, start: '8:45', end: '10:15', subj: 'Основы алгоритмизации и программирования', type: 'практика', sub: 2, room: '315', teacher: 'Журавлева Т.А.' },
            { week: 'odd', day: 'Суббота', pair: 2, start: '10:25', end: '11:55', subj: 'Основы алгоритмизации и программирования', type: 'практика', sub: 1, room: '315', teacher: 'Журавлева Т.А.' },
            { week: 'odd', day: 'Суббота', pair: 2, start: '10:25', end: '11:55', subj: 'Операт.сист.и среды', type: 'практика', sub: 2, room: '302', teacher: 'Щукин Е.Ю.' },
            { week: 'even', day: 'Суббота', pair: 1, start: '8:45', end: '10:15', subj: 'Операт.сист.и среды', type: 'практика', sub: 1, room: '302', teacher: 'Щукин Е.Ю.' },
            { week: 'even', day: 'Суббота', pair: 1, start: '8:45', end: '10:15', subj: 'Основы алгоритмизации и программирования', type: 'практика', sub: 2, room: '315', teacher: 'Журавлева Т.А.' },
            { week: 'even', day: 'Суббота', pair: 2, start: '10:25', end: '11:55', subj: 'Основы алгоритмизации и программирования', type: 'практика', sub: 1, room: '315', teacher: 'Журавлева Т.А.' },
            { week: 'even', day: 'Суббота', pair: 2, start: '10:25', end: '11:55', subj: 'Операт.сист.и среды', type: 'практика', sub: 2, room: '302', teacher: 'Щукин Е.Ю.' }
        ];

        for (const s of scheduleData) {
            await pool.query(
                `INSERT INTO schedule (week_type, day_of_week, pair_number, start_time, end_time, subject, type, subgroup, room, teacher) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [s.week, s.day, s.pair, s.start, s.end, s.subj, s.type, s.sub, s.room, s.teacher]
            );
        }
        console.log('Облачная база данных Neon успешно инициализирована!');
    }
}

initDB().then(() => {
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
        const { week } = req.query;
        let query = `SELECT * FROM schedule`;
        let params = [];
        if (week && week !== 'all') {
            query += ` WHERE week_type = ?`;
            params.push(week);
        }
        db.all(query, params, (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });

    app.post('/api/schedule/update', (req, res) => {
        const { schedule_id, is_cancelled, homework, userRole } = req.body;
        if (userRole !== 'admin') {
            return res.status(403).json({ error: 'Только староста может изменять расписание!' });
        }
        db.run(`UPDATE schedule SET is_cancelled = ?, homework = ? WHERE id = ?`, [is_cancelled ? 1 : 0, homework || '', schedule_id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true });
        });
    });

    app.get('/api/attendance', (req, res) => {
        const { date, schedule_id } = req.query;
        db.all(`SELECT student_id, status, comment FROM attendance WHERE date = ? AND schedule_id = ?`, [date, schedule_id], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });

    app.post('/api/attendance', (req, res) => {
        const { date, schedule_id, records, userRole } = req.body;
        if (userRole === 'kurator' || userRole === 'student') {
            return res.status(403).json({ error: 'У вас нет прав на редактирование посещаемости!' });
        }
        db.serialize(() => {
            db.run(`DELETE FROM attendance WHERE date = ? AND schedule_id = ?`, [date, schedule_id], async (err) => {
                if (err) return res.status(500).json({ error: err.message });
                
                for (const r of records) {
                    if (r.status !== 'present') {
                        await pool.query(
                            `INSERT INTO attendance (date, schedule_id, student_id, status, comment) VALUES ($1, $2, $3, $4, $5)`,
                            [date, schedule_id, r.student_id, r.status, r.comment || '']
                        );
                    }
                }
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
                SUM(CASE WHEN a.status = 'absent_invalid' THEN 1 ELSE 0 END) as invalid_absences,
                SUM(CASE WHEN a.status = 'absent_valid' THEN 1 ELSE 0 END) as valid_absences,
                COUNT(a.id) as total_absences
            FROM users u
            LEFT JOIN attendance a ON u.id = a.student_id
            WHERE u.role = 'student'
            GROUP BY u.id, u.full_name, u.subgroup
            ORDER BY total_absences DESC, u.full_name ASC
        `;
        db.all(query, [], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
    });

    app.get('/api/student-stats', (notes, res) => {
        // Заглушка
    });

    app.listen(PORT, () => {
        console.log(`Сервер запущен на порту ${PORT}`);
    });
});
