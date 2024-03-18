import { createLogger, format, transports } from 'winston';

const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp(),
        format.printf((info) => {
            // Форматирование логов в одну строку
            const message =
                typeof info.message === 'object'
                    ? JSON.stringify(info.message)
                    : info.message;
            return `${info.timestamp} [${info.level}]: ${message}`;
        }),
    ),
    transports: [new transports.Console()],
});

export default logger;
