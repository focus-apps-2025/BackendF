const Joi = require('joi');

const boatBaseSchema = {
     boatNumber: Joi.string()
         .required()
         .trim()
         .uppercase()
         .pattern(/^[A-Z0-9-]+$/)
         .messages({
             'string.pattern.base': 'Boat number can only contain uppercase letters, numbers, and hyphens',
             'any.required': 'Boat number is required'
         }),
     boatName: Joi.string()
         .required()
         .trim()
         .min(2)
         .max(100)
         .messages({
             'string.min': 'Boat name must be at least 2 characters long',
             'string.max': 'Boat name cannot exceed 100 characters',
             'any.required': 'Boat name is required'
         }),
     ownerId: Joi.string()
         .pattern(/^[0-9a-fA-F]{24}$/)
         .required()
         .messages({
             'string.pattern.base': 'Invalid owner ID format',
             'any.required': 'Owner ID is required'
         }),
     agentId: Joi.string()
         .pattern(/^[0-9a-fA-F]{24}$/)
         .optional()
         .allow(null, ''),
     locationId: Joi.string()
         .pattern(/^[0-9a-fA-F]{24}$/)
         .optional()
         .allow(null, ''),
     subLocationId: Joi.string()
         .pattern(/^[0-9a-fA-F]{24}$/)
         .optional()
         .allow(null, ''),
     registrationNumber: Joi.string()
         .trim()
         .uppercase()
         .max(50),
     capacity: Joi.number()
         .min(0)
         .max(999999)
         .messages({
             'number.min': 'Capacity cannot be negative'
         }),
     isActive: Joi.boolean()
 };

// Create boat schema
const createBoatSchema = Joi.object(boatBaseSchema);

// Update boat schema
const updateBoatSchema = Joi.object({
    ...boatBaseSchema,
    boatNumber: Joi.string()
        .trim()
        .uppercase()
        .pattern(/^[A-Z0-9-]+$/)
        .messages({
            'string.pattern.base': 'Boat number can only contain uppercase letters, numbers, and hyphens'
        })
}).min(1);

// Boat ID param schema
const boatIdSchema = Joi.object({
    id: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid boat ID format',
            'any.required': 'Boat ID is required'
        })
});

// Boat list query schema
const boatListQuerySchema = Joi.object({
    page: Joi.number()
        .min(1)
        .default(1),
    limit: Joi.number()
        .min(1)
        .max(100)
        .default(10),
    locationId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/),
    subLocationId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/),
    ownerId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/),
    agentId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/),
    isActive: Joi.boolean(),
    search: Joi.string()
        .min(1),
    sortBy: Joi.string()
        .valid('boatNumber', 'boatName', 'createdAt')
        .default('createdAt'),
    sortOrder: Joi.string()
        .valid('asc', 'desc')
        .default('desc')
});

module.exports = {
    createBoatSchema,
    updateBoatSchema,
    boatIdSchema,
    boatListQuerySchema
};