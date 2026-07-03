/**
 * Get pagination parameters from request query
 * @param {Object} query - Request query object
 * @param {number} defaultLimit - Default limit
 * @param {number} maxLimit - Maximum limit
 * @returns {Object} Pagination parameters
 */
const getPaginationParams = (query, defaultLimit = 10, maxLimit = 100) => {
    const page = Math.max(1, parseInt(query.page) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit) || defaultLimit));
    const skip = (page - 1) * limit;

    return { page, limit, skip };
};

/**
 * Get sort parameters from request query
 * @param {Object} query - Request query object
 * @param {string} defaultSort - Default sort field
 * @param {string} defaultOrder - Default sort order
 * @returns {Object} Sort object for MongoDB
 */
const getSortParams = (query, defaultSort = 'createdAt', defaultOrder = 'desc') => {
    const sortField = query.sort || defaultSort;
    const sortOrder = query.order === 'asc' ? 1 : -1;

    return { [sortField]: sortOrder };
};

/**
 * Get filter parameters from request query
 * @param {Object} query - Request query object
 * @param {Array} allowedFields - Allowed filter fields
 * @returns {Object} Filter object for MongoDB
 */
const getFilterParams = (query, allowedFields = []) => {
    const filter = {};

    allowedFields.forEach(field => {
        if (query[field] !== undefined && query[field] !== '') {
            filter[field] = query[field];
        }
    });

    return filter;
};

/**
 * Build pagination metadata
 * @param {number} total - Total number of items
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object} Pagination metadata
 */
const buildPaginationMeta = (total, page, limit) => {
    const totalPages = Math.ceil(total / limit);

    return {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
    };
};

/**
 * Apply pagination to Mongoose query
 * @param {Object} query - Mongoose query
 * @param {Object} pagination - Pagination parameters
 * @returns {Object} Paginated Mongoose query
 */
const applyPagination = (query, pagination) => {
    return query
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean();
};

module.exports = {
    getPaginationParams,
    getSortParams,
    getFilterParams,
    buildPaginationMeta,
    applyPagination
};