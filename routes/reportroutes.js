// routes/reportroutes.js

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportcontroller');
const { authenticate } = require('../middleware/authmiddleware');
const { authorize } = require('../middleware/rbacmiddleware');
const { validate } = require('../middleware/validatemiddleware');
const Joi = require('joi');

// ✅ FIXED: Allow same day
const dateRangeSchema = Joi.object({
    fromDate: Joi.date()
        .required()
        .messages({
            'any.required': 'From date is required'
        }),
    toDate: Joi.date()
        .required()
        .min(Joi.ref('fromDate'))  // ✅ Changed from 'greater' to 'min'
        .messages({
            'date.min': 'To date must be after or on from date',
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
        .min(Joi.ref('fromDate'))
});

// All report routes require authentication
router.use(authenticate);

// Commission agents can access revenue reports, super admins can access everything
const isSuperAdmin = authorize('SUPER_ADMIN');
const isCommissionAgentOrSuperAdmin = authorize('SUPER_ADMIN', 'COMMISSION_AGENT');

// Revenue reports - accessible by COMMISSION_AGENT and SUPER_ADMIN
router.get('/revenue',
    isCommissionAgentOrSuperAdmin,
    validate(dateRangeSchema, 'query'),
    reportController.getRevenueReport
);

// Revenue by fish
router.get('/revenue-by-fish',
    isCommissionAgentOrSuperAdmin,
    validate(dateRangeSchema, 'query'),
    reportController.getRevenueByFish
);

// Revenue by location
router.get('/revenue-by-location',
    isCommissionAgentOrSuperAdmin,
    validate(dateRangeSchema, 'query'),
    reportController.getRevenueByLocation
);

// Bills summary
router.get('/bills-summary',
    isCommissionAgentOrSuperAdmin,
    validate(dateRangeSchema, 'query'),
    reportController.getBillsSummary
);

// Dashboard summary
router.get('/dashboard-summary',
    isCommissionAgentOrSuperAdmin,
    validate(dateRangeSchema, 'query'),
    reportController.getDashboardSummary
);

// Audit logs - SUPER_ADMIN only
router.get('/audit-logs',
    isSuperAdmin,
    validate(auditLogQuerySchema, 'query'),
    reportController.getAuditLogs
);

module.exports = router;