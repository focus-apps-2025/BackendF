const Ledger = require('../models/ledgermodel');
const { getPaginationParams, buildPaginationMeta } = require('../utils/paginationutils');
const logger = require('../config/logger');

class LedgerService {
    /**
     * Create ledger entry
     * @param {Object} entryData - Ledger entry data
     * @returns {Promise<Object>} Created ledger entry
     */
    async createLedgerEntry(entryData) {
        // Calculate current balance
        const lastEntry = await Ledger.findOne({ boatId: entryData.boatId })
            .sort({ date: -1 })
            .lean();

        const currentBalance = lastEntry ? lastEntry.balance : 0;
        const newBalance = entryData.type === 'CREDIT'
            ? currentBalance + entryData.amount
            : currentBalance - entryData.amount;

        const entry = new Ledger({
            ...entryData,
            balance: newBalance
        });

        await entry.save();
        logger.info(`Ledger entry created for boat ${entryData.boatId}`);
        return entry;
    }

    /**
     * Get ledger entries for a boat with pagination
     * @param {string} boatId - Boat ID
     * @param {Object} filters - Filter parameters
     * @param {Object} pagination - Pagination parameters
     * @returns {Promise<Object>} Ledger entries with pagination
     */
    async getLedgerByBoat(boatId, filters, pagination) {
        const { page, limit, skip } = pagination;

        const query = {
            boatId,
            isDeleted: false
        };

        if (filters.fromDate) {
            query.date = { $gte: new Date(filters.fromDate) };
        }
        if (filters.toDate) {
            query.date = { ...query.date, $lte: new Date(filters.toDate) };
        }
        if (filters.type) {
            query.type = filters.type;
        }

        const [entries, total] = await Promise.all([
            Ledger.find(query)
                .populate('billId', 'billNumber')
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Ledger.countDocuments(query)
        ]);

        return {
            data: entries,
            pagination: buildPaginationMeta(total, page, limit)
        };
    }

    /**
     * Get ledger summary for an owner
     * @param {string} ownerId - Owner user ID
     * @returns {Promise<Object>} Ledger summary
     */
    async getLedgerSummaryByOwner(ownerId) {
        const entries = await Ledger.find({
            ownerId,
            isDeleted: false
        }).lean();

        if (entries.length === 0) {
            return {
                totalCredit: 0,
                totalDebit: 0,
                currentBalance: 0,
                boatCount: 0
            };
        }

        const boats = new Set(entries.map(e => e.boatId.toString()));
        const totalCredit = entries
            .filter(e => e.type === 'CREDIT')
            .reduce((sum, e) => sum + e.amount, 0);
        const totalDebit = entries
            .filter(e => e.type === 'DEBIT')
            .reduce((sum, e) => sum + e.amount, 0);

        return {
            totalCredit,
            totalDebit,
            currentBalance: totalCredit - totalDebit,
            boatCount: boats.size
        };
    }

    /**
     * Get current balance for a boat
     * @param {string} boatId - Boat ID
     * @returns {Promise<number>} Current balance
     */
    async getCurrentBalance(boatId) {
        const lastEntry = await Ledger.findOne({ boatId, isDeleted: false })
            .sort({ date: -1 })
            .lean();

        return lastEntry ? lastEntry.balance : 0;
    }

    /**
     * Get all boats with their current balance
     * @param {string} agentId - Agent ID (optional)
     * @returns {Promise<Array>} List of boats with balances
     */
    async getAllBoatBalances(agentId = null) {
        const match = { isDeleted: false };
        if (agentId) match.agentId = agentId;

        const boats = await Ledger.aggregate([
            { $match: match },
            { $sort: { date: -1 } },
            {
                $group: {
                    _id: '$boatId',
                    balance: { $first: '$balance' }
                }
            },
            {
                $lookup: {
                    from: 'boats',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'boat'
                }
            },
            { $unwind: '$boat' },
            {
                $project: {
                    boatId: '$_id',
                    boatNumber: '$boat.boatNumber',
                    boatName: '$boat.boatName',
                    balance: 1
                }
            }
        ]);

        return boats;
    }
}

module.exports = new LedgerService();