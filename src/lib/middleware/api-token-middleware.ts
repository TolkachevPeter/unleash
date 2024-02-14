/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { ApiTokenType } from '../types/models/api-token';
import { IUnleashConfig } from '../types/option';

const isClientApi = ({ path }) => {
    return path && path.startsWith('/api/client');
};

const isProxyApi = ({ path }) => {
    if (!path) {
        return;
    }

    // Handle all our current proxy paths which will redirect to the new
    // embedded proxy endpoint
    return (
        path.startsWith('/api/default/proxy') ||
        path.startsWith('/api/development/proxy') ||
        path.startsWith('/api/production/proxy') ||
        path.startsWith('/api/frontend')
    );
};

export const TOKEN_TYPE_ERROR_MESSAGE =
    'invalid token: expected a different token type for this endpoint';

const decodeBasicAuth = (authHeader) => {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString(
        'ascii',
    );
    const separatorIndex = credentials.indexOf(':');
    const username = credentials.substring(0, separatorIndex);
    const password = credentials.substring(separatorIndex + 1);
    return { username, password };
};

const apiAccessMiddleware = (
    {
        getLogger,
        authentication,
        flagResolver,
    }: Pick<IUnleashConfig, 'getLogger' | 'authentication' | 'flagResolver'>,
    { apiTokenService }: any,
): any => {
    const logger = getLogger('/middleware/api-token.ts');
    logger.debug('Enabling api-token middleware');

    if (!authentication.enableApiToken) {
        return (req, res, next) => next();
    }

    return (req, res, next) => {
        if (req.user) {
            return next();
        }

        try {
            const authHeader = req.header('authorization');
            let apiToken;
            // Обработка Basic Authentication
            if (authHeader.startsWith('Basic')) {
                console.log('req', req.headers);
                const { password } = decodeBasicAuth(authHeader);
                console.log('password: ', password);
                apiToken = password;
            } else {
                // Обработка стандартного токена
                apiToken = authHeader;
            }

            const apiUser = apiTokenService.getUserForToken(apiToken);
            const { CLIENT, FRONTEND } = ApiTokenType;

            if (apiUser) {
                if (
                    (apiUser.type === CLIENT && !isClientApi(req)) ||
                    (apiUser.type === FRONTEND && !isProxyApi(req)) ||
                    (apiUser.type === FRONTEND &&
                        !flagResolver.isEnabled('embedProxy'))
                ) {
                    res.status(403).send({ message: TOKEN_TYPE_ERROR_MESSAGE });
                    return;
                }
                req.user = apiUser;
            }
        } catch (error) {
            logger.error(error);
        }

        next();
    };
};

export default apiAccessMiddleware;
