const reportService = require('../services/reportservice');
const { successResponse, paginatedResponse, errorResponse } = require('../utils/responseutils');
const { getPaginationParams, buildPaginationMeta } = require('../utils/paginationutils');
const logger = require('../config/logger');

/**
 * Get revenue report
 */
const getRevenueReport = async (req, res, next) => {
    try {
        const report = await reportService.getRevenueReport(req.query, req.user);
        successResponse(res, 200, 'Revenue report generated successfully', report);
    } catch (error) {
        logger.error('Get revenue report error:', error);
        errorResponse(res, 500, error.message || 'Failed to generate revenue report');
    }
};

/**
 * Get revenue by fish
 */
const getRevenueByFish = async (req, res, next) => {
    try {
        const report = await reportService.getRevenueByFish(req.query, req.user);
        successResponse(res, 200, 'Revenue by fish report generated successfully', report);
    } catch (error) {
        logger.error('Get revenue by fish error:', error);
        errorResponse(res, 500, error.message || 'Failed to generate revenue by fish report');
    }
};

/**
 * Get revenue by location
 */
const getRevenueByLocation = async (req, res, next) => {
    try {
        const report = await reportService.getRevenueByLocation(req.query, req.user);
        successResponse(res, 200, 'Revenue by location report generated successfully', report);
    } catch (error) {
        logger.error('Get revenue by location error:', error);
        errorResponse(res, 500, error.message || 'Failed to generate revenue by location report');
    }
};

/**
 * Get bills summary
 */
const getBillsSummary = async (req, res, next) => {
    try {
        const summary = await reportService.getBillsSummary(req.query, req.user);
        successResponse(res, 200, 'Bills summary generated successfully', summary);
    } catch (error) {
        logger.error('Get bills summary error:', error);
        errorResponse(res, 500, error.message || 'Failed to generate bills summary');
    }
};

/**
 * Get audit logs
 */
const getAuditLogs = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPaginationParams(req.query);
        const { data, total } = await reportService.getAuditLogs(
            req.query,
            { page, limit, skip },
            req.user
        );
        paginatedResponse(res, 200, 'Audit logs retrieved successfully', data, buildPaginationMeta(total, page, limit));
    } catch (error) {
        logger.error('Get audit logs error:', error);
        errorResponse(res, 500, error.message || 'Failed to get audit logs');
    }
};

/**
 * Get dashboard summary
 */
const getDashboardSummary = async (req, res, next) => {
    try {
        const summary = await reportService.getDashboardSummary(req.query, req.user);
        successResponse(res, 200, 'Dashboard summary retrieved successfully', summary);
    } catch (error) {
        logger.error('Get dashboard summary error:', error);
        errorResponse(res, 500, error.message || 'Failed to get dashboard summary');
    }
};

module.exports = {
    getRevenueReport,
    getRevenueByFish,
    getRevenueByLocation,
    getBillsSummary,
    getAuditLogs,
    getDashboardSummary
};