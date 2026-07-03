const Joi = require('joi');

const ledgerBaseSchema = {
    boatId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid boat ID format',
            'any.required': 'Boat ID is required'
        }),
    agentId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid agent ID format',
            'any.required': 'Agent ID is required'
        }),
    ownerId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid owner ID format',
            'any.required': 'Owner ID is required'
        }),
    billId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
            'string.pattern.base': 'Invalid bill ID format'
        }),
    type: Joi.string()
        .valid('CREDIT', 'DEBIT')
        .required()
        .messages({
            'any.only': 'Type must be either CREDIT or DEBIT',
            'any.required': 'Transaction type is required'
        }),
    amount: Joi.number()
        .required()
        .min(0.01)
        .max(999999999)
        .messages({
            'number.min': 'Amount must be greater than 0',
            'any.required': 'Amount is required'
        }),
    balance: Joi.number()
        .required()
        .messages({
            'any.required': 'Balance is required'
        }),
    description: Joi.string()
        .required()
        .trim()
        .max(500)
        .messages({
            'any.required': 'Description is required',
            'string.max': 'Description cannot exceed 500 characters'
        }),
    date: Joi.date()
        .default(Date.now)
};

// Create ledger entry schema
const createLedgerSchema = Joi.object(ledgerBaseSchema);

// Ledger list query schema
const ledgerListQuerySchema = Joi.object({
    page: Joi.number()
        .min(1)
        .default(1),
    limit: Joi.number()
        .min(1)
        .max(100)
        .default(10),
    boatId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid boat ID format',
            'any.required': 'Boat ID is required'
        }),
    fromDate: Joi.date(),
    toDate: Joi.date()
        .greater(Joi.ref('fromDate'))
        .messages({
            'date.greater': 'To date must be after from date'
        }),
    type: Joi.string()
        .valid('CREDIT', 'DEBIT')
});

module.exports = {
    createLedgerSchema,
    ledgerListQuerySchema
};