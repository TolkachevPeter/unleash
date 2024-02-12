import { Client } from 'vertica-nodejs';
import { IUnleashConfig } from '../types/option';

export function createDbVertica({
    db,
    getLogger,
}: Pick<IUnleashConfig, 'db' | 'getLogger'>): {
    query(
        sql: string,
        params: any[],
        callback: (err: Error | null, res?: any) => void,
    ): Promise<void>;
    destroy: () => Promise<void>;
} {
    const logger = getLogger('db-pool.js');

    const verticaConfig = {
        host: db.host,
        port: db.port,
        user: db.user,
        password: db.password,
        database: db.database,
    };

    const client = new Client(verticaConfig);

    (async () => {
        try {
            await client.connect();
            logger.debug('Подключение к Vertica успешно установлено.');
            const testQuery = 'SELECT version();';
            const testResult = await client.query(testQuery);
            logger.debug(
                `Тестовый запрос выполнен успешно: ${JSON.stringify(
                    testResult,
                )}`,
            );
            await client.end();
        } catch (err) {
            logger.error('Ошибка при тестовом подключении к Vertica:', err);
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
                // Закрытие соединения после выполнения запроса
                await client.end();
            }
        },
        destroy: async () => {
            await client.end();
        },
    };
}
