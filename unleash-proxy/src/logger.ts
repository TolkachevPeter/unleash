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

const extractErrorDetails = (err: any) => {
    if (err instanceof Error) {
        return {
            message: err.message,
            stack: err.stack,
            name: err.name,
        };
    }
    return err;
};

function formatMessage(message: any, args: any[]): string {
    let formattedMessage = '';

    if (message instanceof Error) {
        formattedMessage += `Error: ${message.message}\nStack: ${message.stack}\n`;
    } else if (typeof message === 'object' && message !== null) {
        formattedMessage += `${JSON.stringify(message)} `;
    } else {
        formattedMessage += `${message} `;
    }

    if (args && args.length > 0) {
        args.forEach((arg) => {
            if (arg instanceof Error) {
                formattedMessage += `Error: ${arg.message}\nStack: ${arg.stack}\n`;
            } else if (typeof arg === 'object' && arg !== null) {
                formattedMessage += `${JSON.stringify(arg)} `;
            } else {
                formattedMessage += `${arg} `;
            }
        });
    }

    return formattedMessage.trim().replace(/\r?\n|\r/g, ' ');
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

    private shouldLog(desired: LogLevel): boolean {
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

    private log(level: LogLevel, message: any, args: any[]) {
        if (this.shouldLog(level)) {
            const timestamp = new Date().toISOString();

            if (this.useJson) {
                const logEntry: any = {
                    timestamp,
                    level,
                };

                if (message instanceof Error) {
                    logEntry.message = message.message;
                    logEntry.stack = message.stack;
                    logEntry.name = message.name;
                } else {
                    logEntry.message = message;
                }

                if (args && args.length > 0) {
                    logEntry.args = args.map((arg) => extractErrorDetails(arg));
                }

                console.log(JSON.stringify(logEntry));
            } else {
                const formattedMessage = formatMessage(message, args);
                console.log(
                    `${timestamp} [${level.toUpperCase()}]: ${formattedMessage}`,
                );
            }
        }
    }
}
