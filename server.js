const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Ошибка подключения к PostgreSQL:', err.message);
    } else {
        console.log('Успешное подключение к облачной базе данных PostgreSQL (Neon)');
    }
});

// Авторизация
app.post('/api/login', async (req, res) => {
    const { login, password } = req.body;
    try {
        const query = `SELECT id, login, full_name, subgroup, role FROM users WHERE login = $1 AND password = $2`;
        const result = await pool.query(query, [login, password]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Ошибка в /api/login:', err.message);
        res.status(500).json({ error: 'Ошибка сервера при входе' });
    }
});

// Получение списка студентов
app.get('/api/students', async (req, res) => {
    try {
        const result = await pool.query(`SELECT id, full_name as name, subgroup, login FROM users WHERE role = 'student' ORDER BY full_name`);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получение расписания
app.get('/api/schedule', async (req, res) => {
    const { week } = req.query;
    try {
        let query = `SELECT * FROM schedule`;
        let params = [];
        if (week && week !== 'all') {
            query += ` WHERE week_type = $1`;
            params.push(week);
        }
        query += ` ORDER BY CASE day_of_week 
            WHEN 'Понедельник' THEN 1 
            WHEN 'Вторник' THEN 2 
            WHEN 'Среда' THEN 3 
            WHEN 'Четверг' THEN 4 
            WHEN 'Пятница' THEN 5 
            WHEN 'Суббота' THEN 6 
            ELSE 7 END, pair_number ASC`;
            
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Обновление расписания (ДЗ / отмена)
app.post('/api/schedule/update', async (req, res) => {
    const { schedule_id, is_cancelled, homework, userRole } = req.body;
    if (userRole !== 'admin') {
        return res.status(403).json({ error: 'Только староста может изменять расписание!' });
    }
    try {
        await pool.query(
            `UPDATE schedule SET is_cancelled = $1, homework = $2 WHERE id = $3`,
            [is_cancelled ? 1 : 0, homework || '', schedule_id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получение посещаемости
app.get('/api/attendance', async (req, res) => {
    const { date, schedule_id } = req.query;
    try {
        const result = await pool.query(
            `SELECT student_id, status, comment FROM attendance WHERE date = $1 AND schedule_id = $2`,
            [date, schedule_id]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Сохранение посещаемости
app.post('/api/attendance', async (req, res) => {
    const { date, schedule_id, records, userRole } = req.body;
    if (userRole === 'kurator' || userRole === 'student') {
        return res.status(403).json({ error: 'У вас нет прав на редактирование посещаемости!' });
    }
    try {
        await pool.query(`DELETE FROM attendance WHERE date = $1 AND schedule_id = $2`, [date, schedule_id]);
        
        for (const r of records) {
            if (r.status !== 'present') {
                await pool.query(
                    `INSERT INTO attendance (date, schedule_id, student_id, status, comment) VALUES ($1, $2, $3, $4, $5)`,
                    [date, schedule_id, r.student_id, r.status, r.comment || '']
                );
            }
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Статистика
app.get('/api/stats', async (req, res) => {
    try {
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
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
