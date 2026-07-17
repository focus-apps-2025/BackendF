const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// General rate limiter
const generalLimiter = rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.max,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health' || req.path === '/api/health';
    }
});

// Auth rate limiter (stricter) - Changed from 15 minutes to 2 minutes
const authLimiter = rateLimit({
    windowMs: 2 * 60 * 1000, // 2 minutes in milliseconds
    max: 5,
    message: {
        success: false,
        message: 'Too many login attempts, please try again after 2 minutes.' // Updated message
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true
});

// API rate limiter
const apiLimiter = rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.max * 2, // Double for API routes
    message: {
        success: false,
        message: 'API rate limit exceeded. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = {
    generalLimiter,
    authLimiter,
    apiLimiter
};