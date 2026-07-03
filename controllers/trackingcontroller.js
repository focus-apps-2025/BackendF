const trackingService = require('../services/trackingservice');
const { successResponse, errorResponse } = require('../utils/responseutils');
const logger = require('../config/logger');

/**
 * Submit coordinates for a boat
 */
const submitCoordinates = async (req, res, next) => {
    try {
        const coordinates = await trackingService.submitCoordinates(
            req.params.boatId,
            req.body,
            req.user
        );
        successResponse(res, 201, 'Coordinates submitted successfully', coordinates);
    } catch (error) {
        logger.error('Submit coordinates error:', error);
        errorResponse(res, 400, error.message || 'Failed to submit coordinates');
    }
};

/**
 * Get latest coordinates for a boat
 */
const getLatestCoordinates = async (req, res, next) => {
    try {
        const coordinates = await trackingService.getLatestCoordinates(
            req.params.boatId,
            req.user
        );
        successResponse(res, 200, 'Coordinates retrieved successfully', coordinates);
    } catch (error) {
        logger.error('Get latest coordinates error:', error);
        errorResponse(res, 404, error.message || 'Coordinates not found');
    }
};

/**
 * Get coordinates history for a boat
 */
const getCoordinatesHistory = async (req, res, next) => {
    try {
        const history = await trackingService.getCoordinatesHistory(
            req.params.boatId,
            req.query,
            req.user
        );
        successResponse(res, 200, 'Coordinates history retrieved successfully', history);
    } catch (error) {
        logger.error('Get coordinates history error:', error);
        errorResponse(res, 500, error.message || 'Failed to get coordinates history');
    }
};

/**
 * Get all boats with latest coordinates
 */
const getAllBoatLocations = async (req, res, next) => {
    try {
        const locations = await trackingService.getAllBoatLocations(req.user);
        successResponse(res, 200, 'Boat locations retrieved successfully', locations);
    } catch (error) {
        logger.error('Get all boat locations error:', error);
        errorResponse(res, 500, error.message || 'Failed to get boat locations');
    }
};

module.exports = {
    submitCoordinates,
    getLatestCoordinates,
    getCoordinatesHistory,
    getAllBoatLocations
};