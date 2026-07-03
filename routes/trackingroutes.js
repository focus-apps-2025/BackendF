const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingcontroller');
const { authenticate, optionalAuth } = require('../middleware/authmiddleware');
const { authorize } = require('../middleware/rbacmiddleware');
const { validate } = require('../middleware/validatemiddleware');
const { auditLog } = require('../middleware/auditLogmiddleware');
const Joi = require('joi');

// Coordinate submission validation
const submitCoordinatesSchema = Joi.object({
    latitude: Joi.number()
        .required()
        .min(-90)
        .max(90)
        .messages({
            'number.min': 'Latitude must be between -90 and 90',
            'number.max': 'Latitude must be between -90 and 90',
            'any.required': 'Latitude is required'
        }),
    longitude: Joi.number()
        .required()
        .min(-180)
        .max(180)
        .messages({
            'number.min': 'Longitude must be between -180 and 180',
            'number.max': 'Longitude must be between -180 and 180',
            'any.required': 'Longitude is required'
        }),
    speed: Joi.number()
        .min(0),
    heading: Joi.number()
        .min(0)
        .max(360),
    recordedAt: Joi.date()
        .default(Date.now)
});

// History query validation
const historyQuerySchema = Joi.object({
    hours: Joi.number()
        .min(1)
        .max(168)
        .default(24),
    startDate: Joi.date(),
    endDate: Joi.date()
        .greater(Joi.ref('startDate'))
});

// Boat ID param validation
const boatIdParamSchema = Joi.object({
    boatId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
});

// Submit coordinates - public endpoint with optional auth
router.post('/:boatId',
    optionalAuth,
    validate(boatIdParamSchema, 'params'),
    validate(submitCoordinatesSchema),
    auditLog,
    trackingController.submitCoordinates
);

// Get latest coordinates - requires authentication
router.get('/:boatId/latest',
    authenticate,
    validate(boatIdParamSchema, 'params'),
    trackingController.getLatestCoordinates
);

// Get coordinates history - requires authentication
router.get('/:boatId/history',
    authenticate,
    validate(boatIdParamSchema, 'params'),
    validate(historyQuerySchema, 'query'),
    trackingController.getCoordinatesHistory
);

// Get all boat locations - requires authentication
router.get('/locations/all',
    authenticate,
    authorize('COMMISSION_AGENT', 'SUPER_ADMIN'),
    trackingController.getAllBoatLocations
);

module.exports = router;