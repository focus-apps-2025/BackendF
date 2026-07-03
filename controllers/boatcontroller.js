const boatService = require('../services/boatservice');
const { successResponse, paginatedResponse, errorResponse } = require('../utils/responseutils');
const { getPaginationParams, getSortParams, buildPaginationMeta } = require('../utils/paginationutils');
const logger = require('../config/logger');

/**
 * Create boat
 */
const createBoat = async (req, res, next) => {
    try {
        const boat = await boatService.createBoat(req.body, req.user);
        successResponse(res, 201, 'Boat created successfully', boat);
    } catch (error) {
        logger.error('Create boat error:', error);
        errorResponse(res, 400, error.message || 'Failed to create boat');
    }
};

/**
 * Get boats with pagination and filters
 */
const getBoats = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPaginationParams(req.query);
        const sort = getSortParams(req.query, 'createdAt', 'desc');

        const { data, total } = await boatService.getBoats(req.query, { page, limit, skip, sort }, req.user);
        paginatedResponse(res, 200, 'Boats retrieved successfully', data, buildPaginationMeta(total, page, limit));
    } catch (error) {
        logger.error('Get boats error:', error);
        errorResponse(res, 500, error.message || 'Failed to get boats');
    }
};

/**
 * Get boat by ID
 */
const getBoatById = async (req, res, next) => {
    try {
        const boat = await boatService.getBoatById(req.params.id, req.user);
        successResponse(res, 200, 'Boat retrieved successfully', boat);
    } catch (error) {
        logger.error('Get boat by ID error:', error);
        errorResponse(res, 404, error.message || 'Boat not found');
    }
};

/**
 * Update boat
 */
const updateBoat = async (req, res, next) => {
    try {
        const boat = await boatService.updateBoat(req.params.id, req.body, req.user);
        successResponse(res, 200, 'Boat updated successfully', boat);
    } catch (error) {
        logger.error('Update boat error:', error);
        errorResponse(res, 400, error.message || 'Failed to update boat');
    }
};

/**
 * Delete boat (soft delete)
 */
const deleteBoat = async (req, res, next) => {
    try {
        await boatService.deleteBoat(req.params.id, req.user);
        successResponse(res, 200, 'Boat deleted successfully');
    } catch (error) {
        logger.error('Delete boat error:', error);
        errorResponse(res, 400, error.message || 'Failed to delete boat');
    }
};

/**
 * Get boats by owner
 */
const getBoatsByOwner = async (req, res, next) => {
    try {
        const boats = await boatService.getBoatsByOwner(req.params.ownerId, req.user);
        successResponse(res, 200, 'Boats retrieved successfully', boats);
    } catch (error) {
        logger.error('Get boats by owner error:', error);
        errorResponse(res, 500, error.message || 'Failed to get boats');
    }
};

/**
 * Get boats by agent
 */
const getBoatsByAgent = async (req, res, next) => {
    try {
        const boats = await boatService.getBoatsByAgent(req.params.agentId, req.user);
        successResponse(res, 200, 'Boats retrieved successfully', boats);
    } catch (error) {
        logger.error('Get boats by agent error:', error);
        errorResponse(res, 500, error.message || 'Failed to get boats');
    }
};

module.exports = {
    createBoat,
    getBoats,
    getBoatById,
    updateBoat,
    deleteBoat,
    getBoatsByOwner,
    getBoatsByAgent
};