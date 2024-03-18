import { Client } from 'vertica-nodejs';
import logger from '../logger/logger';

const verticaConfig = {
    host: process.env.VERTICA_HOST,
    port: parseInt(process.env.VERTICA_PORT || '5433'),
    user: process.env.VERTICA_USER,
    password: process.env.VERTICA_PASSWORD,
    database: process.env.VERTICA_DATABASE,
    ssl: process.env.VERTICA_SSL === 'true',
};

const verticaClient = new Client(verticaConfig);

verticaClient.connect((err: any) => {
    if (err) {
        logger.error('Ошибка подключения к Vertica:', err);
    } else {
        logger.info('Успешное подключение к Vertica');
    }
});

export default verticaClient;
