const Joi = require('joi');

const userBaseSchema = {
    name: Joi.string()
        .min(2)
        .max(100)
        .required()
        .messages({
            'string.min': 'Name must be at least 2 characters long',
            'string.max': 'Name cannot exceed 100 characters',
            'any.required': 'Name is required'
        }),
    email: Joi.string()
        .email()
        .required()
        .messages({
            'string.email': 'Please provide a valid email address',
            'any.required': 'Email is required'
        }),
    phone: Joi.string()
        .pattern(/^[0-9]{10}$/)
        .messages({
            'string.pattern.base': 'Phone number must be 10 digits'
        }),
    role: Joi.string()
        .valid('SUPER_ADMIN', 'COMMISSION_AGENT', 'STAFF', 'FISH_BUYER', 'BOAT_OWNER')
        .required()
        .messages({
            'any.only': 'Invalid role selected',
            'any.required': 'Role is required'
        }),
    locationId: Joi.string()
        .optional()
        .messages({
            'string.base': 'Location ID must be a valid string'
        }),
    subLocationId: Joi.string()
        .optional()
        .messages({
            'string.base': 'Sub-location ID must be a valid string'
        }),
    agentId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .when('role', {
            is: Joi.string().valid('STAFF', 'FISH_BUYER'),
            then: Joi.required().messages({
                'any.required': 'Agent ID is required for staff and buyers'
            })
        }),
    isActive: Joi.boolean()
};

// Create user schema
const createUserSchema = Joi.object({
    ...userBaseSchema,
    password: Joi.string()
        .required()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/)
        .messages({
            'string.min': 'Password must be at least 8 characters long',
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
            'any.required': 'Password is required'
        })
});

// Update user schema
const updateUserSchema = Joi.object({
    ...userBaseSchema,
    password: Joi.string()
        .min(8)
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/)
        .messages({
            'string.min': 'Password must be at least 8 characters long',
            'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
        })
}).min(1);

// User ID param schema
const userIdSchema = Joi.object({
    id: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            'string.pattern.base': 'Invalid user ID format',
            'any.required': 'User ID is required'
        })
});

// User list query schema
const userListQuerySchema = Joi.object({
    page: Joi.number()
        .min(1)
        .default(1),
    limit: Joi.number()
        .min(1)
        .max(100)
        .default(10),
    role: Joi.string()
        .valid('SUPER_ADMIN', 'COMMISSION_AGENT', 'STAFF', 'FISH_BUYER', 'BOAT_OWNER'),
    locationId: Joi.string()
        .optional(),
    search: Joi.string()
        .min(1),
    isActive: Joi.boolean(),
    sortBy: Joi.string()
        .valid('name', 'email', 'role', 'createdAt')
        .default('createdAt'),
    sortOrder: Joi.string()
        .valid('asc', 'desc')
        .default('desc')
});

module.exports = {
    createUserSchema,
    updateUserSchema,
    userIdSchema,
    userListQuerySchema
};