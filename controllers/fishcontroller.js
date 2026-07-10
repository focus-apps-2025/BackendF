const fishService = require('../services/fishservice');
const { successResponse, paginatedResponse, errorResponse } = require('../utils/responseutils');
const { getPaginationParams, getSortParams, buildPaginationMeta } = require('../utils/paginationutils');
const logger = require('../config/logger');

/**
 * Create fish
 */
const createFish = async (req, res, next) => {
    try {
        // ✅ Validate required fields
        if (!req.body.name || req.body.name.trim().isEmpty) {
            return errorResponse(res, 400, 'Fish name is required');
        }

        const fish = await fishService.createFish(req.body, req.user);
        successResponse(res, 201, 'Fish created successfully', fish);
    } catch (error) {
        logger.error('Create fish error:', error);

        // ✅ Better error messages
        if (error.message.includes('already exists')) {
            return errorResponse(res, 409, error.message);
        }
        if (error.message.includes('Invalid agent')) {
            return errorResponse(res, 400, error.message);
        }
        if (error.message.includes('validation failed')) {
            return errorResponse(res, 400, 'Invalid fish data provided');
        }

        errorResponse(res, 400, error.message || 'Failed to create fish');
    }
};


/**
 * Get fish with pagination and filters
 */
const getFish = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPaginationParams(req.query);
        const sort = getSortParams(req.query, 'name', 'asc');

        const { data, total } = await fishService.getFish(req.query, { page, limit, skip, sort }, req.user);
        paginatedResponse(res, 200, 'Fish retrieved successfully', data, buildPaginationMeta(total, page, limit));
    } catch (error) {
        logger.error('Get fish error:', error);
        errorResponse(res, 500, error.message || 'Failed to get fish');
    }
};

/**
 * Get fish by ID
 */
const getFishById = async (req, res, next) => {
    try {
        const fish = await fishService.getFishById(req.params.id, req.user);
        successResponse(res, 200, 'Fish retrieved successfully', fish);
    } catch (error) {
        logger.error('Get fish by ID error:', error);
        errorResponse(res, 404, error.message || 'Fish not found');
    }
};

/**
 * Update fish
 */
const updateFish = async (req, res, next) => {
    try {
        const fish = await fishService.getFishById(req.params.id, req.user);

        if (req.user.role === 'FISH_BUYER' && fish.agentId.toString() !== req.user._id.toString()) {
            return errorResponse(res, 403, 'You can only update fish you created');
        }

        const updatedFish = await fishService.updateFish(req.params.id, req.body, req.user);
        successResponse(res, 200, 'Fish updated successfully', updatedFish);
    } catch (error) {
        logger.error('Update fish error:', error);
        errorResponse(res, 400, error.message || 'Failed to update fish');
    }
};

/**
 * Delete fish (soft delete)
 */
// fishcontroller.js
const deleteFish = async (req, res, next) => {
    try {
        // ✅ Check if user exists
        if (!req.user) {
            logger.error('Delete fish failed: No authenticated user');
            return errorResponse(res, 401, 'Authentication required');
        }

        const fishId = req.params.id;

        // ✅ Validate fish ID
        if (!fishId) {
            return errorResponse(res, 400, 'Fish ID is required');
        }

        // ✅ Pass user to service
        await fishService.deleteFish(fishId, req.user);
        successResponse(res, 200, 'Fish deleted successfully');
    } catch (error) {
        logger.error('Delete fish error:', error);

        // ✅ Better error handling
        if (error.message === 'Fish not found') {
            return errorResponse(res, 404, 'Fish not found');
        }
        if (error.message.includes('only delete')) {
            return errorResponse(res, 403, error.message);
        }
        if (error.message === 'Authentication required') {
            return errorResponse(res, 401, error.message);
        }

        errorResponse(res, 400, error.message || 'Failed to delete fish');
    }
};
/**
 * Get fish by agent
 */
const getFishByAgent = async (req, res, next) => {
    try {
        const fish = await fishService.getFishByAgent(req.params.agentId, req.user);
        successResponse(res, 200, 'Fish retrieved successfully', fish);
    } catch (error) {
        logger.error('Get fish by agent error:', error);
        errorResponse(res, 500, error.message || 'Failed to get fish');
    }
};

module.exports = {
    createFish,
    getFish,
    getFishById,
    updateFish,
    deleteFish,
    getFishByAgent
};