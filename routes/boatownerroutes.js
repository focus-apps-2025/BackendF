const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { authenticate } = require('../middleware/authmiddleware');
const { authorize } = require('../middleware/rbacmiddleware');
const { validate } = require('../middleware/validatemiddleware');
const boatOwnerController = require('../controllers/boatownercontroller');

// ─── Validation Schemas ───────────────────────────────────────────────────────

const objectId = Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .messages({ 'string.pattern.base': 'Invalid ID format' });

// Fishing Location
const saveFishingLocationSchema = Joi.object({
    boatId: objectId.required().messages({ 'any.required': 'Boat ID is required' }),
    date: Joi.date().default(() => new Date()),
    latitude: Joi.number().required().min(-90).max(90).messages({
        'number.min': 'Latitude must be between -90 and 90',
        'number.max': 'Latitude must be between -90 and 90',
        'any.required': 'Latitude is required',
    }),
    longitude: Joi.number().required().min(-180).max(180).messages({
        'number.min': 'Longitude must be between -180 and 180',
        'number.max': 'Longitude must be between -180 and 180',
        'any.required': 'Longitude is required',
    }),
});

const fishingLocationQuerySchema = Joi.object({
    boatId: objectId,
    fromDate: Joi.date(),
    toDate: Joi.date().greater(Joi.ref('fromDate')).messages({
        'date.greater': 'toDate must be after fromDate',
    }),
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(500).default(10),
});

// Manual Ledger
const INCOME_CATEGORIES = ['FISH_SALE', 'OTHER_INCOME'];
const EXPENSE_CATEGORIES = ['DIESEL', 'FUEL', 'ICE', 'LABOUR', 'FOOD', 'REPAIR', 'MAINTENANCE', 'OTHER_EXPENSE'];

const createLedgerSchema = Joi.object({
    boatId: objectId.required().messages({ 'any.required': 'Boat ID is required' }),
    date: Joi.date().default(() => new Date()),
    type: Joi.string().valid('INCOME', 'EXPENSE').required().messages({
        'any.only': 'Type must be INCOME or EXPENSE',
        'any.required': 'Type is required',
    }),
    category: Joi.string()
        .valid(...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES)
        .required()
        .messages({
            'any.only': 'Invalid category',
            'any.required': 'Category is required',
        }),
    amount: Joi.number().required().min(0.01).messages({
        'number.min': 'Amount must be greater than 0',
        'any.required': 'Amount is required',
    }),
    description: Joi.string().max(500).allow('', null),
});

const updateLedgerSchema = Joi.object({
    boatId: objectId,
    date: Joi.date(),
    type: Joi.string().valid('INCOME', 'EXPENSE'),
    category: Joi.string().valid(...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES),
    amount: Joi.number().min(0.01),
    description: Joi.string().max(500).allow('', null),
}).min(1); // At least one field must be provided

const ledgerQuerySchema = Joi.object({
    boatId: objectId,
    type: Joi.string().valid('INCOME', 'EXPENSE'),
    category: Joi.string().valid(...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES),
    fromDate: Joi.date(),
    toDate: Joi.date().greater(Joi.ref('fromDate')).messages({
        'date.greater': 'toDate must be after fromDate',
    }),
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(500).default(10),
});

// Bills
const billQuerySchema = Joi.object({
    boatId: objectId,
    fromDate: Joi.date(),
    toDate: Joi.date(),
    createdBy: objectId,
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(500).default(10),
});

const idParamSchema = Joi.object({
    id: objectId.required(),
});

// ─── Middleware ───────────────────────────────────────────────────────────────

// All routes: authenticate + BOAT_OWNER only
router.use(authenticate);
router.use(authorize('BOAT_OWNER', 'SUPER_ADMIN'));

// ─── Dashboard ───────────────────────────────────────────────────────────────
router.get('/dashboard', boatOwnerController.getDashboard);

// ─── Bills ───────────────────────────────────────────────────────────────────
router.get('/bills',
    validate(billQuerySchema, 'query'),
    boatOwnerController.getBills
);

router.get('/bills/:id',
    validate(idParamSchema, 'params'),
    boatOwnerController.getBillById
);

// ─── Manual Ledger ────────────────────────────────────────────────────────────

// IMPORTANT: /ledger/summary must come before /ledger/:id to avoid "summary" being matched as an id param
router.get('/ledger/summary',
    validate(ledgerQuerySchema, 'query'),
    boatOwnerController.getLedgerSummary
);

router.get('/ledger',
    validate(ledgerQuerySchema, 'query'),
    boatOwnerController.getLedger
);

router.post('/ledger',
    validate(createLedgerSchema),
    boatOwnerController.createLedgerEntry
);

router.put('/ledger/:id',
    validate(idParamSchema, 'params'),
    validate(updateLedgerSchema),
    boatOwnerController.updateLedgerEntry
);

router.delete('/ledger/:id',
    validate(idParamSchema, 'params'),
    boatOwnerController.deleteLedgerEntry
);

// ─── Fishing Locations ────────────────────────────────────────────────────────
router.post('/fishing-locations',
    validate(saveFishingLocationSchema),
    boatOwnerController.saveFishingLocation
);

router.get('/fishing-locations',
    validate(fishingLocationQuerySchema, 'query'),
    boatOwnerController.getFishingLocations
);

router.delete('/fishing-locations/:id',
    validate(idParamSchema, 'params'),
    boatOwnerController.deleteFishingLocation
);

// ─── Profile ──────────────────────────────────────────────────────────────────
router.get('/profile', boatOwnerController.getProfile);

module.exports = router;
