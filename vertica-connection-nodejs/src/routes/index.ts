import { Router, Request, Response } from 'express';
import verticaClient from '../vertica-client/vertica-client';
import logger from '../logger/logger';

const router = Router();

router.get('/vertica', async (req: Request, res: Response) => {
    const column = req.query.column as string | undefined;
    const value = req.query.value as string | undefined;

    const table = process.env.VERTICA_TABLE_NAME;
    const allowedColumns = process.env.VERTICA_ALLOWED_COLUMNS?.split(',');
    const isDevMode = process.env.NODE_ENV === 'development';

    if (!table) {
        logger.error('Table name is not defined in .env');
        return res.status(400).send('Table name is not defined in .env');
    }

    if (!allowedColumns) {
        logger.error('Allowed columns are not defined.');
        return res.status(400).send('Allowed columns are not defined.');
    }

    let query = `SELECT * FROM ${table}`;
    let queryParams = [];

    if (isDevMode || (column && value && allowedColumns.includes(column))) {
        if (column && value) {
            query += ` WHERE ${column} = ?`;
            queryParams.push(value);
        }
    } else {
        logger.error(
            'In production mode, both column and value must be provided.',
        );
        return res
            .status(400)
            .send('Both column and value must be provided in production mode.');
    }

    try {
        const result = await verticaClient.query(query, queryParams);
        logger.info(
            `Query executed successfully: ${query} with params ${JSON.stringify(
                queryParams,
            )}; Result: ${JSON.stringify(result.rows)}`,
        );
        res.json(result.rows);
    } catch (error) {
        logger.error(`Database query error: ${error}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
