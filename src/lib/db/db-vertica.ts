/* eslint-disable no-param-reassign */
const Vertica = require('vertica-nodejs');
import { IUnleashConfig } from '../types/option';

export function createDbVertica({
    db,
    getLogger,
}: Pick<IUnleashConfig, 'db' | 'getLogger'>): {
    query: (sql: any, params: any, callback: any) => void;
    destroy: () => any;
} {
    const logger = getLogger('db-pool.js');

    const verticaConfig = {
        host: db.host,
        port: db.port,
        user: db.user,
        password: db.password,
        database: db.database,
    };

    const client = Vertica.connect(verticaConfig, (err) => {
        if (err) {
            logger.error('Ошибка подключения к Vertica:', err);
            return;
        }
        logger.debug('Успешное подключение к Vertica');
    });

    return {
        query: (sql, params, callback) => {
            if (typeof params === 'function') {
                callback = params;
                params = [];
            }
            client.query(sql, params, (err, res) => {
                if (err) {
                    logger.error('Ошибка выполнения запроса:', err);
                    callback(err, null);
                } else {
                    callback(null, res);
                }
            });
        },
        destroy: () => client.end(),
    };
}
