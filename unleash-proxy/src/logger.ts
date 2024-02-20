/* eslint-disable class-methods-use-this */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */

export enum LogLevel {
    debug = 'debug',
    info = 'info',
    warn = 'warn',
    error = 'error',
    fatal = 'fatal',
}

const weight = new Map<LogLevel, number>([
    [LogLevel.debug, 0],
    [LogLevel.info, 1],
    [LogLevel.warn, 2],
    [LogLevel.error, 3],
    [LogLevel.fatal, 4],
]);

const resolve = (logLevel: LogLevel) => {
    const w = weight.get(logLevel);
    return w || -1;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const stripEmptyArray = (arr: any[]) => {
    if (!arr || arr.length === 0) {
        return '';
    }
    return arr;
};

function formatMessage(message: any, args: any[]): string {
    const completeMessage = [message, ...args]
        .map((arg) =>
            typeof arg === 'object' && arg !== null ? JSON.stringify(arg) : arg,
        )
        .join(' ');
    return completeMessage.replace(/\r?\n|\r/g, ' ');
}

export interface Logger {
    debug(message: any, ...args: any[]): void;
    info(message: any, ...args: any[]): void;
    warn(message: any, ...args: any[]): void;
    error(message: any, ...args: any[]): void;
    fatal(message: any, ...args: any[]): void;
}

export class SimpleLogger implements Logger {
    private logLevel: LogLevel;

    private useJson: boolean;

    constructor(logLevel: LogLevel = LogLevel.warn, useJson: boolean = false) {
        this.logLevel = logLevel;
        this.useJson = useJson;
    }

    shouldLog(desired: LogLevel) {
        return resolve(desired) >= resolve(this.logLevel);
    }

    debug(message: any, ...args: any[]): void {
        this.log(LogLevel.debug, message, args);
    }

    info(message: any, ...args: any[]): void {
        this.log(LogLevel.info, message, args);
    }

    warn(message: any, ...args: any[]): void {
        this.log(LogLevel.warn, message, args);
    }

    error(message: any, ...args: any[]): void {
        this.log(LogLevel.error, message, args);
    }

    fatal(message: any, ...args: any[]): void {
        this.log(LogLevel.fatal, message, args);
    }

    log(level: LogLevel, message: any, args: any[]) {
        if (this.shouldLog(level)) {
            if (this.useJson) {
                console.log(JSON.stringify({ level, message, args }));
            } else {
                const formattedMessage = formatMessage(message, args);
                console.log(
                    `${level.toString().toUpperCase()}: ${formattedMessage}`,
                );
            }
        }
    }
}
