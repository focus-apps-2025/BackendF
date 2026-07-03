/**
 * Success response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Success message
 * @param {*} data - Data to send
 * @param {Object} meta - Additional metadata
 */
const successResponse = (res, statusCode = 200, message = 'Success', data = null, meta = {}) => {
    const response = {
        success: true,
        message,
        data
    };

    if (Object.keys(meta).length > 0) {
        response.meta = meta;
    }

    return res.status(statusCode).json(response);
};

/**
 * Error response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {*} errors - Additional error details
 */
const errorResponse = (res, statusCode = 400, message = 'Error', errors = null) => {
    const response = {
        success: false,
        message
    };

    if (errors) {
        response.errors = errors;
    }

    return res.status(statusCode).json(response);
};

/**
 * Paginated response
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Success message
 * @param {*} data - Data to send
 * @param {Object} pagination - Pagination details
 */
const paginatedResponse = (res, statusCode = 200, message = 'Success', data = [], pagination = {}) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
        pagination: {
            page: pagination.page || 1,
            limit: pagination.limit || 10,
            total: pagination.total || data.length,
            totalPages: Math.ceil((pagination.total || data.length) / (pagination.limit || 10))
        }
    });
};

module.exports = {
    successResponse,
    errorResponse,
    paginatedResponse
};