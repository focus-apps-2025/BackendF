const mongoose = require('mongoose');
const logger = require('./logger');
const env = require('./env');

class Database {
    constructor() {
        this.isConnected = false;
    }

    async connect() {
        if (this.isConnected) {
            logger.info('Database already connected');
            return;
        }

        try {
            const options = {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                family: 4
            };

            await mongoose.connect(env.mongodbUri, options);

            this.isConnected = true;
            logger.info(`MongoDB connected successfully to ${env.mongodbUri}`);

            // Handle connection events
            mongoose.connection.on('error', (error) => {
                logger.error('MongoDB connection error:', error);
                this.isConnected = false;
            });

            mongoose.connection.on('disconnected', () => {
                logger.warn('MongoDB disconnected');
                this.isConnected = false;
            });

            // Graceful shutdown
            process.on('SIGINT', this.disconnect.bind(this));

        } catch (error) {
            logger.error('MongoDB connection failed:', error);
            throw error;
        }
    }

    async disconnect() {
        if (!this.isConnected) return;

        try {
            await mongoose.connection.close();
            this.isConnected = false;
            logger.info('MongoDB disconnected gracefully');
        } catch (error) {
            logger.error('Error disconnecting MongoDB:', error);
        }
    }

    getConnection() {
        return mongoose.connection;
    }
}

module.exports = new Database();