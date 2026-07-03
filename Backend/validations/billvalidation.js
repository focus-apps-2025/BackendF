const Joi = require('joi');

const fishEntrySchema = Joi.object({
    fishId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .allow(null, ''),
    fishName: Joi.string()
        .trim()
        .max(100)
        .allow('', null),
    weightKg: Joi.number()
        .min(0.001)
        .max(99999)
        .allow(null),
    pricePerKg: Joi.number()
        .min(0)
        .max(999999)
        .allow(null),
    totalAmount: Joi.number()
        .min(0)
        .max(999999999)
        .allow(null)
});

const billBaseSchema = {
    billNumber: Joi.string()
        .trim()
        .uppercase()
        .pattern(/^BILL-\d{8}-\d{4}$/)
        .messages({
            'string.pattern.base': 'Invalid bill number format'
        }),
    boatId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid boat ID format',
            'any.required': 'Boat ID is required'
        }),
    agentId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .allow(null, ''),
    staffId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .allow(null, ''),
    buyerId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .allow(null, ''),
    locationId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .allow(null, ''),
    subLocationId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .allow(null, ''),
    fishEntries: Joi.array()
        .items(fishEntrySchema)
        .allow(null, ''),
    commissionRate: Joi.number()
        .min(0)
        .max(100)
        .default(0)
        .messages({
            'number.min': 'Commission rate cannot be negative',
            'number.max': 'Commission rate cannot exceed 100%'
        }),
    status: Joi.string()
        .valid('DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED')
        .default('DRAFT'),
    paymentMethod: Joi.string()
        .valid('CASH', 'BANK_TRANSFER', 'UPI'),
    notes: Joi.string()
        .trim()
        .max(500)
        .allow('', null),
    billDate: Joi.date()
        .default(Date.now)
};

// Create bill schema
const createBillSchema = Joi.object(billBaseSchema);

// Update bill schema
const updateBillSchema = Joi.object({
    status: Joi.string()
        .valid('DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED')
        .messages({
            'any.only': 'Invalid status'
        }),
    paymentMethod: Joi.string()
        .valid('CASH', 'BANK_TRANSFER', 'UPI'),
    notes: Joi.string()
        .trim()
        .max(500)
        .allow('', null),
    fishEntries: Joi.array()
        .items(fishEntrySchema)
        .min(1)
        .messages({
            'array.min': 'At least one fish entry is required'
        }),
    commissionRate: Joi.number()
        .min(0)
        .max(100)
        .messages({
            'number.min': 'Commission rate cannot be negative',
            'number.max': 'Commission rate cannot exceed 100%'
        })
}).min(1);

// Bill ID param schema
const billIdSchema = Joi.object({
    id: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid bill ID format',
            'any.required': 'Bill ID is required'
        })
});

// Bill list query schema
const billListQuerySchema = Joi.object({
    page: Joi.number()
        .min(1)
        .default(1),
    limit: Joi.number()
        .min(1)
        .max(100)
        .default(10),
    boatId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/),
    agentId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/),
    buyerId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/),
    locationId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/),
    status: Joi.string()
        .valid('DRAFT', 'CONFIRMED', 'PAID', 'CANCELLED'),
    fromDate: Joi.date(),
    toDate: Joi.date()
        .greater(Joi.ref('fromDate'))
        .messages({
            'date.greater': 'To date must be after from date'
        }),
    search: Joi.string()
        .min(1),
    sortBy: Joi.string()
        .valid('billNumber', 'billDate', 'grandTotal', 'createdAt')
        .default('billDate'),
    sortOrder: Joi.string()
        .valid('asc', 'desc')
        .default('desc')
});

module.exports = {
    createBillSchema,
    updateBillSchema,
    billIdSchema,
    billListQuerySchema
};