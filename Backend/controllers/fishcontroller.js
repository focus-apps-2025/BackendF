const fishService = require('../services/fishservice');
const { successResponse, paginatedResponse, errorResponse } = require('../utils/responseutils');
const { getPaginationParams, getSortParams, buildPaginationMeta } = require('../utils/paginationutils');
const logger = require('../config/logger');

/**
 * Create fish
 */
const createFish = async (req, res, next) => {
    try {
        const fish = await fishService.createFish(req.body, req.user);
        successResponse(res, 201, 'Fish created successfully', fish);
    } catch (error) {
        logger.error('Create fish error:', error);
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
        const fish = await fishService.updateFish(req.params.id, req.body, req.user);
        successResponse(res, 200, 'Fish updated successfully', fish);
    } catch (error) {
        logger.error('Update fish error:', error);
        errorResponse(res, 400, error.message || 'Failed to update fish');
    }
};

/**
 * Delete fish (soft delete)
 */
const deleteFish = async (req, res, next) => {
    try {
        await fishService.deleteFish(req.params.id, req.user);
        successResponse(res, 200, 'Fish deleted successfully');
    } catch (error) {
        logger.error('Delete fish error:', error);
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