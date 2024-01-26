import { FromSchema } from 'json-schema-to-ts';

export const proxyMetricsSchema = {
    $id: '#/components/schemas/proxyMetricsSchema',
    type: 'object',
    required: ['appName', 'instanceId', 'bucket'],
    properties: {
        appName: { type: 'string' },
        instanceId: { type: 'string' },
        environment: { type: 'string' },
        bucket: {
            type: 'object',
            required: ['start', 'stop', 'toggles'],
            properties: {
                start: { type: 'string', format: 'date-time' },
                stop: { type: 'string', format: 'date-time' },
                toggles: {
                    type: 'object',
                    example: {
                        myCoolToggle: {
                            frontendAppName: 'myFrontendAppName', // Пример использования
                            yes: 25,
                            no: 42,
                            variants: {
                                blue: 6,
                                green: 15,
                                red: 46,
                            },
                        },
                        myOtherToggle: {
                            frontendAppName: 'myFrontendAppName', // Пример использования
                            yes: 0,
                            no: 100,
                        },
                    },
                    additionalProperties: {
                        type: 'object',
                        properties: {
                            frontendAppName: { type: 'string' }, // Добавляем как необязательное свойство
                            yes: { type: 'integer', minimum: 0 },
                            no: { type: 'integer', minimum: 0 },
                            variants: {
                                type: 'object',
                                additionalProperties: {
                                    type: 'integer',
                                    minimum: 0,
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    components: {},
} as const;

export type ProxyMetricsSchema = FromSchema<typeof proxyMetricsSchema>;
