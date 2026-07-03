const Joi = require('joi');

const fishBaseSchema = {
    name: Joi.string()
        .required()
        .trim()
        .uppercase()
        .min(2)
        .max(50)
        .messages({
            'string.min': 'Fish name must be at least 2 characters long',
            'string.max': 'Fish name cannot exceed 50 characters',
            'any.required': 'Fish name is required'
        }),
    localName: Joi.string()
        .trim()
        .max(50)
        .messages({
            'string.max': 'Local name cannot exceed 50 characters'
        }),
    pricePerKg: Joi.number()
        .required()
        .min(0)
        .max(999999)
        .messages({
            'number.min': 'Price per kg cannot be negative',
            'any.required': 'Price per kg is required'
        }),
    category: Joi.string()
        .trim()
        .uppercase()
        .max(50),
    agentId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid agent ID format',
            'any.required': 'Agent ID is required'
        }),
    isActive: Joi.boolean()
};

// Create fish schema
const createFishSchema = Joi.object(fishBaseSchema);

// Update fish schema
const updateFishSchema = Joi.object({
    ...fishBaseSchema,
    name: Joi.string()
        .trim()
        .uppercase()
        .min(2)
        .max(50)
        .messages({
            'string.min': 'Fish name must be at least 2 characters long',
            'string.max': 'Fish name cannot exceed 50 characters'
        }),
    pricePerKg: Joi.number()
        .min(0)
        .max(999999)
        .messages({
            'number.min': 'Price per kg cannot be negative'
        })
}).min(1);

// Fish ID param schema
const fishIdSchema = Joi.object({
    id: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid fish ID format',
            'any.required': 'Fish ID is required'
        })
});

// Fish list query schema
const fishListQuerySchema = Joi.object({
    page: Joi.number()
        .min(1)
        .default(1),
    limit: Joi.number()
        .min(1)
        .max(100)
        .default(10),
    agentId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/),
    category: Joi.string()
        .trim()
        .uppercase(),
    isActive: Joi.boolean(),
    search: Joi.string()
        .min(1),
    sortBy: Joi.string()
        .valid('name', 'pricePerKg', 'createdAt')
        .default('name'),
    sortOrder: Joi.string()
        .valid('asc', 'desc')
        .default('asc')
});

module.exports = {
    createFishSchema,
    updateFishSchema,
    fishIdSchema,
    fishListQuerySchema
};