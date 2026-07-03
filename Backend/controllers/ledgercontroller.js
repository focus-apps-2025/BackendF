const ledgerService = require('../services/ledgerservice');
const { successResponse, paginatedResponse, errorResponse } = require('../utils/responseutils');
const { getPaginationParams, getSortParams, buildPaginationMeta } = require('../utils/paginationutils');
const logger = require('../config/logger');

/**
 * Get ledger entries by boat
 */
const getLedgerByBoat = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPaginationParams(req.query);

        const { data, pagination } = await ledgerService.getLedgerByBoat(
            req.params.boatId,
            req.query,
            { page, limit, skip }
        );

        successResponse(res, 200, 'Ledger entries retrieved successfully', data, pagination);
    } catch (error) {
        logger.error('Get ledger by boat error:', error);
        errorResponse(res, 500, error.message || 'Failed to get ledger entries');
    }
};

/**
 * Get ledger summary by owner
 */
const getLedgerSummaryByOwner = async (req, res, next) => {
    try {
        const summary = await ledgerService.getLedgerSummaryByOwner(req.params.ownerId);
        successResponse(res, 200, 'Ledger summary retrieved successfully', summary);
    } catch (error) {
        logger.error('Get ledger summary by owner error:', error);
        errorResponse(res, 500, error.message || 'Failed to get ledger summary');
    }
};

/**
 * Get current balance for a boat
 */
const getCurrentBalance = async (req, res, next) => {
    try {
        const balance = await ledgerService.getCurrentBalance(req.params.boatId);
        successResponse(res, 200, 'Balance retrieved successfully', { balance });
    } catch (error) {
        logger.error('Get current balance error:', error);
        errorResponse(res, 500, error.message || 'Failed to get balance');
    }
};

/**
 * Get all boat balances
 */
const getAllBoatBalances = async (req, res, next) => {
    try {
        const balances = await ledgerService.getAllBoatBalances(req.user.agentId);
        successResponse(res, 200, 'Boat balances retrieved successfully', balances);
    } catch (error) {
        logger.error('Get all boat balances error:', error);
        errorResponse(res, 500, error.message || 'Failed to get boat balances');
    }
};

/**
 * Create ledger entry (internal use)
 */
const createLedgerEntry = async (req, res, next) => {
    try {
        const entry = await ledgerService.createLedgerEntry(req.body);
        successResponse(res, 201, 'Ledger entry created successfully', entry);
    } catch (error) {
        logger.error('Create ledger entry error:', error);
        errorResponse(res, 400, error.message || 'Failed to create ledger entry');
    }
};

module.exports = {
    getLedgerByBoat,
    getLedgerSummaryByOwner,
    getCurrentBalance,
    getAllBoatBalances,
    createLedgerEntry
};