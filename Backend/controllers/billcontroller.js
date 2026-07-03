const billService = require('../services/billservice');
const { successResponse, paginatedResponse, errorResponse } = require('../utils/responseutils');
const { getPaginationParams, getSortParams, buildPaginationMeta } = require('../utils/paginationutils');
const logger = require('../config/logger');

/**
 * Create bill
 */
const createBill = async (req, res, next) => {
    try {
        const bill = await billService.createBill(req.body, req.user._id);
        successResponse(res, 201, 'Bill created successfully', bill);
    } catch (error) {
        logger.error('Create bill error:', error);
        errorResponse(res, 400, error.message || 'Failed to create bill');
    }
};

/**
 * Get bills with pagination and filters
 */
const getBills = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPaginationParams(req.query);
        const sort = getSortParams(req.query, 'billDate', 'desc');

        const { data, total } = await billService.getBills(req.query, { page, limit, skip, sort }, req.user);
        paginatedResponse(res, 200, 'Bills retrieved successfully', data, buildPaginationMeta(total, page, limit));
    } catch (error) {
        logger.error('Get bills error:', error);
        errorResponse(res, 500, error.message || 'Failed to get bills');
    }
};

/**
 * Get bill by ID
 */
const getBillById = async (req, res, next) => {
    try {
        const bill = await billService.getBillById(req.params.id, req.user);
        successResponse(res, 200, 'Bill retrieved successfully', bill);
    } catch (error) {
        logger.error('Get bill by ID error:', error);
        errorResponse(res, 404, error.message || 'Bill not found');
    }
};

/**
 * Update bill
 */
const updateBill = async (req, res, next) => {
    try {
        const bill = await billService.updateBill(req.params.id, req.body, req.user);
        successResponse(res, 200, 'Bill updated successfully', bill);
    } catch (error) {
        logger.error('Update bill error:', error);
        errorResponse(res, 400, error.message || 'Failed to update bill');
    }
};

/**
 * Delete bill (soft delete)
 */
const deleteBill = async (req, res, next) => {
    try {
        await billService.deleteBill(req.params.id, req.user);
        successResponse(res, 200, 'Bill deleted successfully');
    } catch (error) {
        logger.error('Delete bill error:', error);
        errorResponse(res, 400, error.message || 'Failed to delete bill');
    }
};

/**
 * Get bill summary by boat
 */
const getBillSummaryByBoat = async (req, res, next) => {
    try {
        const summary = await billService.getBillSummaryByBoat(req.params.boatId, req.user);
        successResponse(res, 200, 'Bill summary retrieved successfully', summary);
    } catch (error) {
        logger.error('Get bill summary by boat error:', error);
        errorResponse(res, 500, error.message || 'Failed to get bill summary');
    }
};

module.exports = {
    createBill,
    getBills,
    getBillById,
    updateBill,
    deleteBill,
    getBillSummaryByBoat
};