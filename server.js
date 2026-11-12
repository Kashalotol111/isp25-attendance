const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Авторизация
app.post('/api/login', async (req, res) => {
    const { login, password } = req.body;
    try {
        const query = `SELECT id, login, full_name, subgroup, role FROM users WHERE login = $1 AND password = $2`;
        const result = await pool.query(query, [login, password]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'Неверный логин или пароль' });
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Студенты
app.get('/api/students', async (req, res) => {
    try {
        const result = await pool.query(`SELECT id, full_name as name, subgroup, login FROM users WHERE role = 'student' ORDER BY full_name`);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Самый надежный эндпоинт расписания с фильтрацией в JavaScript
app.get('/api/schedule', async (req, res) => {
    const { week, date, day, user_id, role } = req.query;
    try {
        let query = `
            SELECT s.*, h.homework as date_hw, h.homework_file as date_file
            FROM schedule s
            LEFT JOIN homeworks h ON s.id = h.schedule_id AND h.date = $1
            WHERE 1=1
        `;
        let params = [date || null];
        
        if (week && week !== 'all') {
            params.push(week);
            query += ` AND s.week_type = $${params.length}`;
        }
        if (day && day !== 'all') {
            params.push(day);
            query += ` AND s.day_of_week = $${params.length}`;
        }

        query += ` ORDER BY CASE s.day_of_week 
            WHEN 'Понедельник' THEN 1 WHEN 'Вторник' THEN 2 WHEN 'Среда' THEN 3 
            WHEN 'Четверг' THEN 4 WHEN 'Пятница' THEN 5 WHEN 'Суббота' THEN 6 ELSE 7 END, s.pair_number ASC`;
            
        const result = await pool.query(query, params);
        
        let rows = result.rows.map(row => ({
            ...row,
            homework: row.date_hw !== null ? row.date_hw : row.homework,
            homework_file: row.date_file !== null ? row.date_file : row.homework_file
        }));

        // Если это студент, фильтруем подгруппы прямо здесь (без сбоев БД)
        if (role === 'student' && user_id) {
            const userRes = await pool.query(`SELECT subgroup FROM users WHERE id = $1`, [user_id]);
            if (userRes.rows.length > 0) {
                const userSubgroup = String(userRes.rows[0].subgroup || '').trim();
                if (userSubgroup) {
                    rows = rows.filter(item => {
                        const itemSub = String(item.subgroup || '').trim();
                        // Студент видит общие пары, пустые подгруппы и строго свою подгруппу
                        return !itemSub || itemSub === 'Общая' || itemSub === 'общая' || itemSub === userSubgroup;
                    });
                }
            }
        }

        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Сохранение ДЗ на конкретную дату
app.post('/api/schedule/update', async (req, res) => {
    const { schedule_id, date, homework, homework_file, userRole } = req.body;
    if (userRole !== 'admin') return res.status(403).json({ error: 'Нет прав!' });
    
    try {
        await pool.query(
            `INSERT INTO homeworks (date, schedule_id, homework, homework_file) 
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (date, schedule_id) 
             DO UPDATE SET homework = EXCLUDED.homework, homework_file = EXCLUDED.homework_file`,
            [date, schedule_id, homework || '', homework_file || '']
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Получение посещаемости
app.get('/api/attendance', async (req, res) => {
    const { date, schedule_id } = req.query;
    try {
        let query = `SELECT student_id, status, comment FROM attendance WHERE 1=1`;
        let params = [];
        if (date) {
            params.push(date);
            query += ` AND date = $${params.length}`;
        }
        if (schedule_id) {
            params.push(schedule_id);
            query += ` AND schedule_id = $${params.length}`;
        }
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Сохранение посещаемости
app.post('/api/attendance', async (req, res) => {
    const { date, schedule_id, records, userRole } = req.body;
    if (userRole !== 'admin') return res.status(403).json({ error: 'Нет прав!' });
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
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Статистика группы
app.get('/api/stats', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT u.id as student_id, u.full_name as name, u.subgroup,
                SUM(CASE WHEN a.status = 'absent_invalid' THEN 1 ELSE 0 END) as invalid_absences,
                SUM(CASE WHEN a.status = 'absent_valid' THEN 1 ELSE 0 END) as valid_absences,
                COUNT(a.id) as total_absences
            FROM users u LEFT JOIN attendance a ON u.id = a.student_id
            WHERE u.role = 'student' GROUP BY u.id, u.full_name, u.subgroup ORDER BY total_absences DESC, u.full_name ASC
        `);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Пропуски конкретного студента
app.get('/api/student-absences', async (req, res) => {
    const { student_id } = req.query;
    try {
        const result = await pool.query(`
            SELECT a.date, s.day_of_week, s.pair_number, s.subject, a.status, a.comment
            FROM attendance a JOIN schedule s ON a.schedule_id = s.id
            WHERE a.student_id = $1 ORDER BY a.date DESC
        `, [student_id]);
        res.json(result.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Статус выполнения ДЗ студентом
app.get('/api/homework-status', async (req, res) => {
    const { student_id, date, schedule_id } = req.query;
    try {
        const result = await pool.query(
            `SELECT is_completed FROM student_homework_status WHERE student_id = $1 AND date = $2 AND schedule_id = $3`,
            [student_id, date, schedule_id]
        );
        res.json(result.rows[0] || { is_completed: false });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/homework-status', async (req, res) => {
    const { student_id, date, schedule_id, is_completed } = req.body;
    try {
        await pool.query(
            `INSERT INTO student_homework_status (student_id, date, schedule_id, is_completed) 
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (student_id, date, schedule_id) 
             DO UPDATE SET is_completed = EXCLUDED.is_completed`,
            [student_id, date, schedule_id, is_completed]
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
