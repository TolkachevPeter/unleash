import { IProxyConfig } from './config';
import Client from './client';
import { Unleash } from './unleash-client/unleash';
import { initialize } from './unleash-client/index';
import Metrics from './unleash-client/metrics';
import { defaultStrategies } from './unleash-client/strategy';

export const createSingletonClient = (config: IProxyConfig): Client => {
    const customHeadersFunction = async () => ({
        Authorization: config.unleashApiToken,
    });

    const unleash = initialize({
        url: config.unleashUrl,
        appName: config.unleashAppName,
        instanceId: config.unleashInstanceId,
        environment: config.environment,
        refreshInterval: config.refreshInterval,
        projectName: config.projectName,
        strategies: config.customStrategies,
        disableMetrics: true,
        namePrefix: config.namePrefix,
        tags: config.tags,
        customHeadersFunction,
        bootstrap: config.bootstrap,
        storageProvider: config.storageProvider,
        ...(!!config.httpOptions ? { httpOptions: config.httpOptions } : {}),
    });

    const metrics = new Metrics({
        disableMetrics: config.disableMetrics,
        appName: config.unleashAppName,
        instanceId: config.unleashInstanceId,
        strategies: defaultStrategies.map((s) => s.name),
        metricsInterval: config.metricsInterval,
        metricsJitter: config.metricsJitter,
        url: config.unleashUrl,
        customHeadersFunction,
        ...(!!config.httpOptions ? { httpOptions: config.httpOptions } : {}),
    });

    return new Client(config, unleash, metrics);
};

export const createNewClient = (
    config: IProxyConfig,
    appName: string,
): Client => {
    const customHeadersFunction = async () => ({
        Authorization: config.unleashApiToken,
    });
    const customConfig = { ...config, unleashAppName: appName };

    const unleash = new Unleash({
        url: customConfig.unleashUrl,
        appName: customConfig.unleashAppName,
        instanceId: customConfig.unleashInstanceId,
        environment: customConfig.environment,
        refreshInterval: customConfig.refreshInterval,
        projectName: customConfig.projectName,
        strategies: customConfig.customStrategies,
        disableMetrics: true,
        namePrefix: customConfig.namePrefix,
        tags: customConfig.tags,
        customHeadersFunction,
        bootstrap: customConfig.bootstrap,
        storageProvider: customConfig.storageProvider,
        ...(!!customConfig.httpOptions
            ? { httpOptions: customConfig.httpOptions }
            : {}),
    });

    const metrics = new Metrics({
        disableMetrics: customConfig.disableMetrics,
        appName: customConfig.unleashAppName,
        instanceId: customConfig.unleashInstanceId,
        strategies: defaultStrategies.map((s) => s.name),
        metricsInterval: customConfig.metricsInterval,
        metricsJitter: customConfig.metricsJitter,
        url: customConfig.unleashUrl,
        customHeadersFunction,
        ...(!!customConfig.httpOptions
            ? { httpOptions: customConfig.httpOptions }
            : {}),
    });

    return new Client(customConfig, unleash, metrics);
};
