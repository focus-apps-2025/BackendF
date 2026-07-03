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

// Auth rate limiter (stricter)
const authLimiter = rateLimit({
    windowMs: env.authRateLimit.windowMs,
    max: env.authRateLimit.max,
    message: {
        success: false,
        message: 'Too many login attempts, please try again after 15 minutes.'
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