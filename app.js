const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const env = require('./config/env');
const logger = require('./config/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errormiddleware');
const { generalLimiter } = require('./middleware/rateLimiter');
const { auditLog } = require('./middleware/auditLogmiddleware');
const bookingRoutes = require('./routes/bookingroutes');
const boatOwnerRoutes = require('./routes/boatownerroutes');


// Import routes
const authRoutes = require('./routes/authroutes');
const fishBuyerBillRoutes = require('./routes/fishBuyerBillRoutes');
const userRoutes = require('./routes/userroutes');
const locationRoutes = require('./routes/locationroutes');
const boatRoutes = require('./routes/boatroutes');
const fishRoutes = require('./routes/fishroutes');
const billRoutes = require('./routes/billroutes');
const ledgerRoutes = require('./routes/ledgerroutes');
const trackingRoutes = require('./routes/trackingroutes');
const reportRoutes = require('./routes/reportroutes');
const seedRoutes = require('./routes/seedroutes');
const invoiceTemplateRoutes = require('./routes/invoiceTemplateRoutes');


// Helper to wrap async handlers for Express 5
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

const app = express();

// Configure CORS for mobile app access
app.use(cors({
    origin: '*', // Allow all origins for development - restrict in production
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true
}));

// Other middlewares
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/boats', boatRoutes);
app.use('/api/fish', fishRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/seed', seedRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/boat-owner', boatOwnerRoutes);
app.use('/api/fish-buyer-bills', fishBuyerBillRoutes);
app.use('/api', invoiceTemplateRoutes);

// Audit logging for all API routes
app.use('/api', auditLog);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

module.exports = app;