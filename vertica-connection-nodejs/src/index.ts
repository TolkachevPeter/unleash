import express from 'express';
import 'dotenv/config';
import routes from './routes';
import morgan from 'morgan';
import logger from './logger/logger';

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    morgan('tiny', {
        stream: { write: (message) => logger.info(message.trim()) },
    }),
);

app.use(routes);

app.listen(PORT, () => {
    logger.info(`Server is running at http://localhost:${PORT}`);
});
