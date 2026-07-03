const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportcontroller');
const { authenticate } = require('../middleware/authmiddleware');
const { authorize } = require('../middleware/rbacmiddleware');
const { validate } = require('../middleware/validatemiddleware');
const Joi = require('joi');

// Report validation schemas
const dateRangeSchema = Joi.object({
    fromDate: Joi.date()
        .required()
        .messages({
            'any.required': 'From date is required'
        }),
    toDate: Joi.date()
        .required()
        .greater(Joi.ref('fromDate'))
        .messages({
            'date.greater': 'To date must be after from date',
            'any.required': 'To date is required'
        })
});

const auditLogQuerySchema = Joi.object({
    page: Joi.number()
        .min(1)
        .default(1),
    limit: Joi.number()
        .min(1)
        .max(100)
        .default(10),
    userId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/),
    action: Joi.string()
        .valid('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'CHANGE_PASSWORD'),
    resource: Joi.string(),
    fromDate: Joi.date(),
    toDate: Joi.date()
        .greater(Joi.ref('fromDate'))
});

// All report routes require authentication and SUPER_ADMIN role
router.use(authenticate);
router.use(authorize('SUPER_ADMIN'));

// Revenue reports
router.get('/revenue',
    validate(dateRangeSchema, 'query'),
    reportController.getRevenueReport
);

// Revenue by fish
router.get('/revenue-by-fish',
    validate(dateRangeSchema, 'query'),
    reportController.getRevenueByFish
);

// Revenue by location
router.get('/revenue-by-location',
    validate(dateRangeSchema, 'query'),
    reportController.getRevenueByLocation
);

// Bills summary
router.get('/bills-summary',
    validate(dateRangeSchema, 'query'),
    reportController.getBillsSummary
);

// Dashboard summary
router.get('/dashboard-summary',
    validate(dateRangeSchema, 'query'),
    reportController.getDashboardSummary
);

// Audit logs
router.get('/audit-logs',
    validate(auditLogQuerySchema, 'query'),
    reportController.getAuditLogs
);

module.exports = router;