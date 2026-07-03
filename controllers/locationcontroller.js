const locationService = require('../services/locationservice');
const { successResponse, errorResponse } = require('../utils/responseutils');
const logger = require('../config/logger');

/**
 * Create location
 */
const createLocation = async (req, res, next) => {
    try {
        const location = await locationService.createLocation(req.body, req.user._id);
        successResponse(res, 201, 'Location created successfully', location);
    } catch (error) {
        logger.error('Create location error:', error);
        errorResponse(res, 400, error.message || 'Failed to create location');
    }
};

/**
 * Get all locations
 */
const getLocations = async (req, res, next) => {
    try {
        const locations = await locationService.getLocations(req.query);
        successResponse(res, 200, 'Locations retrieved successfully', locations);
    } catch (error) {
        logger.error('Get locations error:', error);
        errorResponse(res, 500, error.message || 'Failed to get locations');
    }
};

/**
 * Get location by ID
 */
const getLocationById = async (req, res, next) => {
    try {
        const location = await locationService.getLocationById(req.params.id);
        successResponse(res, 200, 'Location retrieved successfully', location);
    } catch (error) {
        logger.error('Get location by ID error:', error);
        errorResponse(res, 404, error.message || 'Location not found');
    }
};

/**
 * Update location
 */
const updateLocation = async (req, res, next) => {
    try {
        const location = await locationService.updateLocation(req.params.id, req.body);
        successResponse(res, 200, 'Location updated successfully', location);
    } catch (error) {
        logger.error('Update location error:', error);
        errorResponse(res, 400, error.message || 'Failed to update location');
    }
};

/**
 * Delete location
 */
const deleteLocation = async (req, res, next) => {
    try {
        await locationService.deleteLocation(req.params.id);
        successResponse(res, 200, 'Location deleted successfully');
    } catch (error) {
        logger.error('Delete location error:', error);
        errorResponse(res, 400, error.message || 'Failed to delete location');
    }
};

/**
 * Create sub-location
 */
const createSubLocation = async (req, res, next) => {
    try {
        const subLocation = await locationService.createSubLocation(req.body, req.user._id);
        successResponse(res, 201, 'Sub-location created successfully', subLocation);
    } catch (error) {
        logger.error('Create sub-location error:', error);
        errorResponse(res, 400, error.message || 'Failed to create sub-location');
    }
};

/**
 * Update sub-location
 */
const updateSubLocation = async (req, res, next) => {
    try {
        const subLocation = await locationService.updateSubLocation(req.params.subId, req.body);
        successResponse(res, 200, 'Sub-location updated successfully', subLocation);
    } catch (error) {
        logger.error('Update sub-location error:', error);
        errorResponse(res, 400, error.message || 'Failed to update sub-location');
    }
};

/**
 * Delete sub-location
 */
const deleteSubLocation = async (req, res, next) => {
    try {
        await locationService.deleteSubLocation(req.params.subId);
        successResponse(res, 200, 'Sub-location deleted successfully');
    } catch (error) {
        logger.error('Delete sub-location error:', error);
        errorResponse(res, 400, error.message || 'Failed to delete sub-location');
    }
};

module.exports = {
    createLocation,
    getLocations,
    getLocationById,
    updateLocation,
    deleteLocation,
    createSubLocation,
    updateSubLocation,
    deleteSubLocation
};