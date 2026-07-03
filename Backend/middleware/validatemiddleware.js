const { errorResponse } = require('../utils/responseutils');
const logger = require('../config/logger');

/**
 * Validation middleware factory
 * @param {Object} schema - Joi validation schema
 * @param {string} property - Request property to validate (body, query, params)
 */
const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        const data = req[property];
        const { error, value } = schema.validate(data, {
            abortEarly: false,
            stripUnknown: true,
            allowUnknown: false
        });

        if (error) {
            const errors = error.details.map((detail) => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            logger.debug('Validation failed:', errors);
            return errorResponse(res, 400, 'Validation failed', errors);
        }

        // Replace request data with validated data
        req[property] = value;
        
        // Handle both Express 4 and Express 5 async patterns
        if (typeof next === 'function') {
            next();
        }
    };
};

module.exports = {
    validate
};