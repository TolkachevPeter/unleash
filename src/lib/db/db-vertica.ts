import { Client } from 'vertica-nodejs';
import { IUnleashConfig } from '../types/option';

export function createDbVertica({
    vertica,
    getLogger,
}: Pick<IUnleashConfig, 'vertica' | 'getLogger'>): {
    query(
        sql: string,
        params: any[],
        callback: (err: Error | null, res?: any) => void,
    ): Promise<void>;
    destroy: () => Promise<void>;
} {
    const logger = getLogger('db-pool.js');

    logger.debug('Vertica configuration: ', vertica);

    const verticaConfig = {
        host: vertica.host,
        port: vertica.port,
        user: vertica.user,
        password: vertica.password,
        database: vertica.database,
    };

    const client = new Client(verticaConfig);

    (async () => {
        try {
            await client.connect();
            logger.debug('Подключение к Vertica успешно установлено.');
            const testQuery = 'SELECT version();';
            const testResult = await client.query(testQuery);
            logger.debug(
                'Тестовый запрос выполнен успешно:',
                testResult.rows[0],
            );
            await client.end();
        } catch (err) {
            logger.error('Ошибка при тестовом подключении к Vertica:', err);
            console.error(err);
        }
    })();

    return {
        async query(sql, params, callback) {
            try {
                await client.connect();
                const res = await client.query(sql, params);
                callback(null, res);
            } catch (err) {
                logger.error('Ошибка выполнения запроса:', err);
                callback(err);
            } finally {
                await client.end();
            }
        },
        destroy: async () => {
            await client.end();
        },
    };
}
