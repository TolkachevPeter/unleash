import { Knex } from 'knex';
import session from 'express-session';
import knexSessionStore from 'connect-session-knex';
import { RequestHandler } from 'express';
import { IUnleashConfig } from '../types/option';
import { minutesToMilliseconds } from 'date-fns';

function sessionDb(
    config: Pick<IUnleashConfig, 'session' | 'server' | 'secureHeaders'>,
    knex: Knex,
): RequestHandler {
    let store;
    const { db, cookieName } = config.session;
    const age =
        minutesToMilliseconds(config.session.ttlMinutes) ||
        minutesToMilliseconds(30);
    const KnexSessionStore = knexSessionStore(session);
    if (db) {
        store = new KnexSessionStore({
            tablename: 'unleash_session',
            createtable: false,
            knex,
        });
    } else {
        store = new session.MemoryStore();
    }

    const simpleString = process.env.UNLEASH_SIMPLE_STRING;
    const sessionValue = [simpleString];
    const encodedKey = Buffer.from(simpleString, 'base64').toString();

    return session({
        name: cookieName,
        rolling: true,
        resave: false,
        saveUninitialized: false,
        store,
        [encodedKey]: sessionValue,
        cookie: {
            path:
                config.server.baseUriPath === ''
                    ? '/'
                    : config.server.baseUriPath,
            secure: config.secureHeaders,
            maxAge: age,
        },
    } as session.SessionOptions);
}

export default sessionDb;
