const fishBuyerBillService = require('../services/fishBuyerBillService');
const { successResponse, paginatedResponse, errorResponse } = require('../utils/responseutils');
const { getPaginationParams, buildPaginationMeta } = require('../utils/paginationutils');
const logger = require('../config/logger');

const createBill = async (req, res, next) => {
    try {
        const bill = await fishBuyerBillService.createBill(req.body, req.user._id);
        successResponse(res, 201, 'Fish Buyer Bill created successfully', bill);
    } catch (error) {
        logger.error('Create fish buyer bill error:', error);
        errorResponse(res, 400, error.message || 'Failed to create bill');
    }
};

const getBills = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPaginationParams(req.query);
        const { data, total } = await fishBuyerBillService.getBills(req.query, { page, limit, skip }, req.user);
        paginatedResponse(res, 200, 'Bills retrieved successfully', data, buildPaginationMeta(total, page, limit));
    } catch (error) {
        logger.error('Get fish buyer bills error:', error);
        errorResponse(res, 500, error.message || 'Failed to get bills');
    }
};

const getBillById = async (req, res, next) => {
    try {
        const bill = await fishBuyerBillService.getBillById(req.params.id, req.user);
        successResponse(res, 200, 'Bill retrieved successfully', bill);
    } catch (error) {
        logger.error('Get fish buyer bill by ID error:', error);
        errorResponse(res, 404, error.message || 'Bill not found');
    }
};

const getBillsByAgent = async (req, res, next) => {
    try {
        const bills = await fishBuyerBillService.getBillsByAgent(req.params.agentId, req.user);
        successResponse(res, 200, 'Bills retrieved successfully', bills);
    } catch (error) {
        logger.error('Get fish buyer bills by agent error:', error);
        errorResponse(res, 500, error.message || 'Failed to get bills');
    }
};

const cancelBill = async (req, res, next) => {
    try {
        const bill = await fishBuyerBillService.cancelBill(req.params.id, req.user);
        successResponse(res, 200, 'Bill cancelled successfully', bill);
    } catch (error) {
        logger.error('Cancel fish buyer bill error:', error);
        errorResponse(res, 400, error.message || 'Failed to cancel bill');
    }
};

const deleteBill = async (req, res, next) => {
    try {
        await fishBuyerBillService.deleteBill(req.params.id, req.user);
        successResponse(res, 200, 'Bill deleted successfully');
    } catch (error) {
        logger.error('Delete fish buyer bill error:', error);
        errorResponse(res, 400, error.message || 'Failed to delete bill');
    }
};

module.exports = {
    createBill,
    getBills,
    getBillById,
    getBillsByAgent,
    cancelBill,
    deleteBill
};