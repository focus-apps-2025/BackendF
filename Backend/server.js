const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const database = require('./config/db');

const PORT = env.port;

// Connect to database and start server
const startServer = async () => {
    try {
        // Connect to MongoDB
        await database.connect();

        // Start server
        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.info(`🚀 Server started successfully`);
            logger.info(`📡 Environment: ${env.nodeEnv}`);
            logger.info(`🔗 URL: http://0.0.0.0:${PORT}`);
            logger.info(`💾 Database: ${env.mongodbUri}`);
        });

        // Graceful shutdown handlers
        const shutdown = async (signal) => {
            logger.info(`Received ${signal}. Shutting down gracefully...`);

            server.close(async () => {
                logger.info('HTTP server closed');

                await database.disconnect();
                logger.info('Database connection closed');

                process.exit(0);
            });

            // Force shutdown after timeout
            setTimeout(() => {
                logger.error('Could not close connections in time, forcefully shutting down');
                process.exit(1);
            }, 10000);
        };

        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));

        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
            process.exit(1);
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Start the server
startServer();