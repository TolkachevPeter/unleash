import { NextFunction, Request, Response, Router } from 'express';
import { IProxyConfig } from './config';
import { IClient } from './client';
import { ContextEnricher } from './enrich-context';
import { Logger } from './logger';
import { OpenApiService } from './openapi/openapi-service';
import { featuresResponse } from './openapi/spec/features-response';
import { NOT_READY_MSG, standardResponses } from './openapi/common-responses';
import { apiRequestResponse } from './openapi/spec/api-request-response';
import { prometheusRequestResponse } from './openapi/spec/prometheus-request-response';
import { ApiRequestSchema } from './openapi/spec/api-request-schema';
import { FeaturesSchema } from './openapi/spec/features-schema';
import { lookupTogglesRequest } from './openapi/spec/lookup-toggles-request';
import { registerMetricsRequest } from './openapi/spec/register-metrics-request';
import { registerClientRequest } from './openapi/spec/register-client-request';
import {
    createDeepObjectRequestParameters,
    createRequestParameters,
} from './openapi/openapi-helpers';
import { RegisterMetricsSchema } from './openapi/spec/register-metrics-schema';
import { LookupTogglesSchema } from './openapi/spec/lookup-toggles-schema';
import { RegisterClientSchema } from './openapi/spec/register-client-schema';
import { createContexMiddleware } from './context-middleware';
import { createNewClient } from './create-client';

export default class UnleashProxy {
    private logger: Logger;

    private clientKeys: string[];

    private serverSideTokens: string[];

    private clientKeysHeaderName: string;

    // private client: IClient;

    private contextEnrichers: ContextEnricher[];

    private ready = false;

    public middleware: Router;

    private enableAllEndpoint = false;

    private clients: Map<string, IClient> = new Map();

    private config: IProxyConfig;

    constructor(config: IProxyConfig, openApiService: OpenApiService) {
        this.logger = config.logger;
        this.clientKeys = config.clientKeys;
        this.serverSideTokens = config.serverSideSdkConfig
            ? config.serverSideSdkConfig.tokens
            : [];
        this.clientKeysHeaderName = config.clientKeysHeaderName;
        // this.client = client;
        this.enableAllEndpoint = config.enableAllEndpoint || false;
        this.contextEnrichers = config.expCustomEnrichers
            ? config.expCustomEnrichers
            : [];
        this.config = config;
        this.ready = true;
        this.cleanupClientsPeriodically();

        const contextMiddleware = createContexMiddleware(this.contextEnrichers);

        // if (client.isReady()) {
        //     this.setReady();
        // }

        // this.client.on('ready', () => {
        //     this.setReady();
        // });

        const router = Router();
        this.middleware = router;

        // Routes
        router.get(
            '',
            openApiService.validPath({
                parameters: [
                    ...createRequestParameters({
                        appName: "Your application's name",
                        userId: "The current user's ID",
                        sessionId: "The current session's ID",
                        remoteAddress: "Your application's IP address",
                    }),
                    ...createDeepObjectRequestParameters({
                        properties: {
                            description: 'Additional (custom) context fields',
                            example: {
                                region: 'Africa',
                                betaTester: 'true',
                            },
                        },
                    }),
                ],
                responses: {
                    ...standardResponses(401, 500, 503),
                    200: featuresResponse,
                },
                description:
                    'This endpoint returns the list of feature toggles that the proxy evaluates to enabled for the given context. Context values are provided as query parameters.',
                summary:
                    'Retrieve enabled feature toggles for the provided context.',
                tags: ['Proxy client'],
            }),
            this.readyMiddleware.bind(this),
            this.clientTokenMiddleware.bind(this),
            contextMiddleware,
            this.getEnabledToggles.bind(this),
        );

        router.get(
            '/all',
            openApiService.validPath({
                parameters: [
                    ...createRequestParameters({
                        appName: "Your application's name",
                        userId: "The current user's ID",
                        sessionId: "The current session's ID",
                        remoteAddress: "Your application's IP address",
                    }),
                    ...createDeepObjectRequestParameters({
                        properties: {
                            description: 'Additional (custom) context fields',
                            example: {
                                region: 'Africa',
                                betaTester: 'true',
                            },
                        },
                    }),
                ],
                responses: {
                    ...standardResponses(401, 500, 501, 503),
                    200: featuresResponse,
                },
                description: `This endpoint returns all feature toggles known to the proxy, along with whether they are enabled or disabled for the provided context. This endpoint always returns **all** feature toggles the proxy retrieves from Unleash, in contrast to the \`/proxy\` endpoints that only return enabled toggles.

Useful if you are migrating to unleash and need to know if the feature flag exists on the Unleash server.

However, using this endpoint will increase the payload size transmitted to your applications. Context values are provided as query parameters.`,
                summary: 'Retrieve all feature toggles from the proxy.',
                tags: ['Proxy client'],
            }),
            this.readyMiddleware.bind(this),
            this.clientTokenMiddleware.bind(this),
            contextMiddleware,
            this.getAllToggles.bind(this),
        );

        router.post(
            '/all',
            openApiService.validPath({
                requestBody: lookupTogglesRequest,
                responses: {
                    ...standardResponses(401, 415, 500, 501, 503),
                    200: featuresResponse,
                },
                description: `This endpoint accepts a JSON object with a \`context\` property and an optional \`toggles\` property.

If you provide the \`toggles\` property, the proxy will use the provided context value to evaluate each of the toggles you sent in. The proxy returns a list with all the toggles you provided in their fully evaluated states.

If you don't provide the \`toggles\` property, then this operation functions exactly the same as the GET operation on this endpoint, except that it uses the \`context\` property instead of query parameters: The proxy will evaluate all its toggles against the context you provide and return a list of all known feature toggles and their evaluated state.`,
                summary:
                    'Evaluate some or all toggles against the provided context.',
                tags: ['Proxy client'],
            }),
            this.readyMiddleware.bind(this),
            this.clientTokenMiddleware.bind(this),
            contextMiddleware,
            this.getAllTogglesPOST.bind(this),
        );

        router.post(
            '',
            openApiService.validPath({
                requestBody: lookupTogglesRequest,
                responses: {
                    ...standardResponses(400, 401, 415, 500, 503),
                    200: featuresResponse,
                },
                description: `This endpoint accepts a JSON object with a \`context\` property and an optional \`toggles\` property.

If you provide the \`toggles\` property, the proxy will use the provided context value to evaluate each of the toggles you sent in. The proxy returns a list with all the toggles you provided in their fully evaluated states.

If you don't provide the \`toggles\` property, then this operation functions exactly the same as the GET operation on this endpoint, except that it uses the \`context\` property instead of query parameters: The proxy will evaluate all its toggles against the context you provide and return a list of enabled toggles.`,
                summary:
                    'Evaluate specific toggles against the provided context.',
                tags: ['Proxy client'],
            }),
            this.readyMiddleware.bind(this),
            this.clientTokenMiddleware.bind(this),
            contextMiddleware,
            this.lookupToggles.bind(this),
        );

        router.get(
            '/client/features',
            openApiService.validPath({
                responses: {
                    ...standardResponses(401, 503),
                    200: apiRequestResponse,
                },
                description:
                    "Returns the toggle configuration from the proxy's internal Unleash SDK. Use this to bootstrap other proxies and server-side SDKs. Requires you to provide one of the proxy's configured `serverSideTokens` for authorization.",
                summary:
                    "Retrieve the proxy's current toggle configuration (as consumed by the internal client).",
                tags: ['Server-side client'],
            }),
            this.readyMiddleware.bind(this),
            this.expServerSideTokenMiddleware.bind(this),
            this.unleashApi.bind(this),
        );

        router.post(
            '/client/metrics',
            openApiService.validPath({
                requestBody: registerMetricsRequest,
                responses: standardResponses(200, 400, 401),
                description:
                    "This endpoint lets you register usage metrics with Unleash. Accepts either one of the proxy's configured `serverSideTokens` or one of its `clientKeys` for authorization.",
                summary: 'Send usage metrics to Unleash.',
                tags: ['Operational', 'Server-side client'],
            }),
            this.registerMetrics.bind(this),
        );

        router.post(
            '/client/register',
            openApiService.validPath({
                requestBody: registerClientRequest,
                responses: standardResponses(200, 400, 401),
                description:
                    "This endpoint lets you register application with Unleash. Accepts either one of the proxy's configured `serverSideTokens` or one of its `clientKeys` for authorization.",
                summary: 'Register clients with Unleash.',
                tags: ['Operational', 'Server-side client'],
            }),
            this.registerClient.bind(this),
        );

        router.get(
            '/health',
            openApiService.validPath({
                security: [],
                responses: {
                    ...standardResponses(200, 503),
                },
                description:
                    'Returns a 200 OK if the proxy is ready to receive requests. Otherwise returns a 503 NOT READY.',
                summary:
                    'Check whether the proxy is ready to serve requests yet.',
                tags: ['Operational'],
            }),
            this.readyMiddleware.bind(this),
            this.health.bind(this),
        );

        router.get(
            '/internal-backstage/prometheus',
            openApiService.validPath({
                security: [],
                responses: {
                    ...standardResponses(503),
                    200: prometheusRequestResponse,
                },
                description:
                    'Returns a 200 and valid Prometheus text syntax if the proxy is ready to receive requests. Otherwise returns a 503 NOT READY.',
                summary: 'Check whether the proxy is up and running',
                tags: ['Operational'],
            }),
            this.readyMiddleware.bind(this),
            this.prometheus.bind(this),
        );
    }

    private setReady() {
        this.ready = true;
        this.logger.info(
            'Successfully synchronized with Unleash API. Proxy is now ready to receive traffic.',
        );
    }

    // kept for backward compatibility
    setProxySecrets(clientKeys: string[]): void {
        this.setClientKeys(clientKeys);
    }

    setClientKeys(clientKeys: string[]): void {
        this.clientKeys = clientKeys;
    }

    private readyMiddleware(req: Request, res: Response, next: NextFunction) {
        if (!this.ready) {
            res.status(503).send(NOT_READY_MSG);
        } else {
            next();
        }
    }

    private clientTokenMiddleware(
        req: Request,
        res: Response,
        next: NextFunction,
    ) {
        const apiToken = req.header(this.clientKeysHeaderName);
        if (!apiToken || !this.clientKeys.includes(apiToken)) {
            res.sendStatus(401);
        } else {
            next();
        }
    }

    private expServerSideTokenMiddleware(
        req: Request,
        res: Response,
        next: NextFunction,
    ) {
        const apiToken = req.header(this.clientKeysHeaderName);
        if (!apiToken || !this.serverSideTokens.includes(apiToken)) {
            res.sendStatus(401);
        } else {
            next();
        }
    }

    async getAllToggles(req: Request, res: Response<FeaturesSchema | string>) {
        if (!this.enableAllEndpoint) {
            res.status(501).send(
                'The /proxy/all endpoint is disabled. Please check your server configuration. To enable it, set the `enableAllEndpoint` configuration option or `ENABLE_ALL_ENDPOINT` environment variable to `true`.',
            );
            return;
        }

        const appName = req.query.appName as string; // Извлекаем appName из строки запроса

        // Проверка на наличие appName и его соответствие строке
        if (!appName) {
            return res.status(400).send('App name is required');
        }

        // Получение клиента для appName
        const client = this.clients.get(appName);
        if (!client) {
            return res
                .status(404)
                .send(`Client for app name ${appName} not found`);
        }

        const { context } = res.locals;
        const toggles = client.getAllToggles(context); // Используем соответствующего клиента
        res.set('Cache-control', 'public, max-age=2');
        res.send({ toggles });
    }

    async getAllTogglesPOST(
        req: Request,
        res: Response<FeaturesSchema | string>,
    ) {
        if (!this.enableAllEndpoint) {
            res.status(501).send(
                'The /proxy/all endpoint is disabled. Please check your server configuration. To enable it, set the `enableAllEndpoint` configuration option or `ENABLE_ALL_ENDPOINT` environment variable to `true`.',
            );
            return;
        }

        const appName = req.body.appName; // Извлекаем appName из тела запроса

        // Проверка на наличие appName и его соответствие строке
        if (!appName || typeof appName !== 'string') {
            return res
                .status(400)
                .send('App name is required and must be a string');
        }

        // Получение клиента для appName
        const client = this.clients.get(appName);
        if (!client) {
            return res
                .status(404)
                .send(`Client for app name ${appName} not found`);
        }

        res.set('Cache-control', 'public, max-age=2');
        const { toggles: toggleNames = [] } = req.body;
        const { context } = res.locals;

        // Использование соответствующего клиента для обработки запроса
        if (toggleNames.length > 0) {
            const toggles = client.getDefinedToggles(toggleNames, context);
            res.send({ toggles });
        } else {
            const toggles = client.getAllToggles(context);
            res.send({ toggles });
        }
    }

    private async getEnabledToggles(
        req: Request,
        res: Response<FeaturesSchema | string>,
    ) {
        const appName = req.query.appName;
        if (!appName || typeof appName !== 'string') {
            return res.status(400).send('App name is required');
        }

        const client = await this.getClientForAppName(appName);
        const { context } = res.locals;
        const toggles = client.getEnabledToggles(context);
        res.set('Cache-control', 'public, max-age=2');
        res.send({ toggles });
    }

    async lookupToggles(
        req: Request<any, any, LookupTogglesSchema>,
        res: Response<FeaturesSchema | string>,
    ) {
        const appName = req.body.appName; // Извлекаем appName из тела запроса

        // Проверка на наличие appName и его соответствие строке
        if (!appName || typeof appName !== 'string') {
            return res
                .status(400)
                .send('App name is required and must be a string');
        }

        // Получение клиента для appName
        const client = this.clients.get(appName);
        if (!client) {
            return res
                .status(404)
                .send(`Client for app name ${appName} not found`);
        }

        res.set('Cache-control', 'public, max-age=2');
        const { toggles: toggleNames = [] } = req.body;
        const { context } = res.locals;

        // Использование клиента, соответствующего appName
        if (toggleNames.length > 0) {
            const toggles = client.getDefinedToggles(toggleNames, context);
            res.send({ toggles });
        } else {
            const toggles = client.getEnabledToggles(context);
            res.send({ toggles });
        }
    }

    health(_: Request, res: Response<string>): void {
        res.send('ok');
    }

    prometheus(_: Request, res: Response<string>): void {
        const prometheusResponse =
            '# HELP unleash_proxy_up Indication that the service is up. \n' +
            '# TYPE unleash_proxy_up counter\n' +
            'unleash_proxy_up 1\n';
        res.set('Content-type', 'text/plain');
        res.send(prometheusResponse);
    }

    registerMetrics(
        req: Request<{}, undefined, RegisterMetricsSchema>,
        res: Response<string>,
    ) {
        const token = req.header(this.clientKeysHeaderName);
        const appName = req.body.appName; // appName получаем из тела запроса

        // Проверка наличия appName и соответствие типа 'string'
        if (!appName || typeof appName !== 'string') {
            return res
                .status(400)
                .send('App name is required and must be a string');
        }

        // Проверка токена на допустимость
        const validTokens = [...this.clientKeys, ...this.serverSideTokens];
        if (!token || !validTokens.includes(token)) {
            return res.sendStatus(401);
        }

        // Получение клиента для appName
        const client = this.clients.get(appName);
        if (!client) {
            return res
                .status(404)
                .send(`Client for app name ${appName} not found`);
        }

        // Регистрация метрик с использованием найденного клиента
        client.registerMetrics(req.body);
        res.sendStatus(200);
    }

    registerClient(
        req: Request<{}, undefined, RegisterClientSchema>,
        res: Response<string>,
    ): void {
        const token = req.header(this.clientKeysHeaderName);
        const validTokens = [...this.clientKeys, ...this.serverSideTokens];

        if (token && validTokens.includes(token)) {
            this.logger.debug('Client registration is not supported yet.');
            res.sendStatus(200);
        } else {
            res.sendStatus(401);
        }
    }

    private async getClientForAppName(appName: string): Promise<IClient> {
        let client = this.clients.get(appName);

        if (!client) {
            client = createNewClient(
                {
                    ...this.config,
                },
                appName,
            );
            this.clients.set(appName, client);

            // Ожидание готовности клиента
            await new Promise((resolve) => {
                if (client.isReady()) {
                    resolve(true);
                } else {
                    client.once('ready', () => resolve(true));
                }
            });
        } else {
            client.lastUsed = Date.now();
        }

        return client;
    }

    private cleanupClientsPeriodically() {
        const clientTTL = 3600000; // 1 час в миллисекундах
        setInterval(() => {
            const now = Date.now();
            const removedClients = []; // Для хранения имен удаленных клиентов
            const activeClients = []; // Для хранения имен активных клиентов

            this.clients.forEach((client, appName) => {
                if (now - client.lastUsed > clientTTL) {
                    this.clients.delete(appName);
                    removedClients.push(appName); // Добавляем имя удаленного клиента
                } else {
                    activeClients.push(appName); // Добавляем имя активного клиента
                }
            });

            // Логирование удаленных клиентов
            if (removedClients.length > 0) {
                this.logger.info(
                    `Removed inactive clients: ${removedClients.join(', ')}`,
                );
            }

            // Логирование активных клиентов (опционально)
            this.logger.info(`Active clients: ${activeClients.join(', ')}`);
        }, clientTTL);
    }

    unleashApi(req: Request, res: Response<string | ApiRequestSchema>) {
        const appName = req.query.appName; // Предполагается, что appName передается в параметрах запроса

        // Проверка на наличие appName и его соответствие строке
        if (!appName || typeof appName !== 'string') {
            return res
                .status(400)
                .send('App name is required and must be a string');
        }

        // Получение клиента для appName
        const client = this.clients.get(appName);
        if (!client) {
            return res
                .status(404)
                .send(`Client for app name ${appName} not found`);
        }

        // Получение определений функций переключения от соответствующего клиента
        const features = client.getFeatureToggleDefinitions();
        res.set('Cache-control', 'public, max-age=2');
        res.send({ version: 2, features });
    }
}
