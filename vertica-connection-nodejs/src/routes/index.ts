import { Router, Request, Response } from 'express';
import verticaClient from '../vertica-client/vertica-client';
const router = Router();

router.get('/vertica', async (req: Request, res: Response) => {
    const column = req.query.column as string | undefined;
    const value = req.query.value as string | undefined;

    // Использование переменной окружения для имени таблицы
    const table = process.env.VERTICA_TABLE_NAME;
    const allowedColumns = process.env.VERTICA_ALLOWED_COLUMNS?.split(',');

    if (!table) {
        return res.status(400).send('Table name is not defined in .env');
    }

    if (!allowedColumns) {
        return res.status(400).send('Allowed columns are not defined.');
    }

    let query = `SELECT * FROM ${table}`;
    let queryParams = [];

    if (column && value && allowedColumns.includes(column)) {
        query += ` WHERE ${column} = ?`;
        queryParams.push(value);
    } else if (column || value) {
        return res.status(400).send('Both column and value must be provided.');
    }

    try {
        const result = await verticaClient.query(query, queryParams);

        res.json(result.rows);
    } catch (error) {
        console.error('Database query error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
