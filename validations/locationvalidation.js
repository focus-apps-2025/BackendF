const Joi = require('joi');

// Create location schema
const createLocationSchema = Joi.object({
    name: Joi.string()
        .required()
        .trim()
        .uppercase()
        .min(2)
        .max(50)
        .messages({
            'string.min': 'Location name must be at least 2 characters long',
            'string.max': 'Location name cannot exceed 50 characters',
            'any.required': 'Location name is required'
        }),
    isActive: Joi.boolean().default(true)
});

// Update location schema
const updateLocationSchema = Joi.object({
    name: Joi.string()
        .trim()
        .uppercase()
        .min(2)
        .max(50)
        .messages({
            'string.min': 'Location name must be at least 2 characters long',
            'string.max': 'Location name cannot exceed 50 characters'
        }),
    isActive: Joi.boolean()
}).min(1);

// Location ID param schema
const locationIdSchema = Joi.object({
    id: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid location ID format',
            'any.required': 'Location ID is required'
        })
});

// Create sub-location schema
const createSubLocationSchema = Joi.object({
    name: Joi.string()
        .required()
        .trim()
        .uppercase()
        .min(2)
        .max(50)
        .messages({
            'string.min': 'Sub-location name must be at least 2 characters long',
            'string.max': 'Sub-location name cannot exceed 50 characters',
            'any.required': 'Sub-location name is required'
        }),
    locationId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid location ID format',
            'any.required': 'Location ID is required'
        }),
    isActive: Joi.boolean().default(true)
});

// Update sub-location schema
const updateSubLocationSchema = Joi.object({
    name: Joi.string()
        .trim()
        .uppercase()
        .min(2)
        .max(50)
        .messages({
            'string.min': 'Sub-location name must be at least 2 characters long',
            'string.max': 'Sub-location name cannot exceed 50 characters'
        }),
    isActive: Joi.boolean()
}).min(1);

// Sub-location ID param schema
const subLocationIdSchema = Joi.object({
    subId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid sub-location ID format',
            'any.required': 'Sub-location ID is required'
        })
});

module.exports = {
    createLocationSchema,
    updateLocationSchema,
    locationIdSchema,
    createSubLocationSchema,
    updateSubLocationSchema,
    subLocationIdSchema
};