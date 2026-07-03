const Bill = require('../models/billmodel');
const Boat = require('../models/boatmodel');
const Fish = require('../models/fishmodel');
const Ledger = require('../models/ledgermodel');
const User = require('../models/usermodel');
const Location = require('../models/locationmodel');
const SubLocation = require('../models/subLocationmodel');
const authService = require('./authservice');
const ledgerService = require('./ledgerservice');
const { getPaginationParams, buildPaginationMeta } = require('../utils/paginationutils');
const logger = require('../config/logger');

class BillService {
    /**
     * Create a new bill
     * @param {Object} billData - Bill data
     * @param {string} userId - User ID creating the bill
     * @returns {Promise<Object>} Created bill
     */
    async createBill(billData, userId) {
        // Generate bill number
        const billNumber = await authService.generateBillNumber(billData.billDate);

        // Auto-set agentId/staffId from user if not provided
        const user = await User.findById(userId);
        const agentId = billData.agentId || (user?.agentId || userId);

        // Calculate totals - handle empty fishEntries
        let subtotal = 0;
        const fishEntries = (billData.fishEntries || []).map(entry => {
            const totalAmount = entry.weightKg * entry.pricePerKg;
            subtotal += totalAmount;
            return {
                ...entry,
                totalAmount
            };
        });

        const commissionAmount = (subtotal * (billData.commissionRate || 0)) / 100;
        const grandTotal = subtotal + commissionAmount;

        const bill = new Bill({
            ...billData,
            billNumber,
            agentId,
            fishEntries,
            subtotal,
            commissionAmount,
            grandTotal,
            staffId: userId // Track who created the bill
        });

        await bill.save();

        // If bill is confirmed, create ledger entries
        if (bill.status === 'CONFIRMED') {
            await this.createLedgerEntries(bill);
        }

        logger.info(`Bill created: ${bill.billNumber} by user ${userId}`);
        return bill;
    }

    /**
     * Get bill by ID
     * @param {string} billId - Bill ID
     * @param {Object} user - Current user
     * @returns {Promise<Object>} Bill with populated fields
     */
    async getBillById(billId, user) {
        const bill = await Bill.findById(billId)
            .populate('boatId', 'boatNumber boatName')
            .populate('agentId', 'name email')
            .populate('staffId', 'name email')
            .populate('buyerId', 'name email')
            .populate('locationId', 'name')
            .populate('subLocationId', 'name')
            .lean();

        if (!bill) {
            throw new Error('Bill not found');
        }

        // Check access
        this.checkBillAccess(bill, user);

        return bill;
    }

    /**
     * Get bills with filters and pagination
     * @param {Object} filters - Filter parameters
     * @param {Object} pagination - Pagination parameters
     * @param {Object} user - Current user
     * @returns {Promise<Object>} Bills with pagination
     */
    async getBills(filters, pagination, user) {
        const { page, limit, skip } = pagination;

        // Build query based on user role
        const query = { isDeleted: false };

        // Apply role-based filtering
        this.applyRoleFilter(query, user);

        // Apply additional filters
        if (filters.boatId) query.boatId = filters.boatId;
        if (filters.agentId) query.agentId = filters.agentId;
        if (filters.buyerId) query.buyerId = filters.buyerId;
        if (filters.locationId) query.locationId = filters.locationId;
        if (filters.status) query.status = filters.status;
        if (filters.fromDate) {
            query.billDate = { $gte: new Date(filters.fromDate) };
        }
        if (filters.toDate) {
            query.billDate = { ...query.billDate, $lte: new Date(filters.toDate) };
        }
        if (filters.search) {
            query.$or = [
                { billNumber: { $regex: filters.search, $options: 'i' } },
                { 'boatId.boatNumber': { $regex: filters.search, $options: 'i' } }
            ];
        }

        const [bills, total] = await Promise.all([
            Bill.find(query)
                .populate('boatId', 'boatNumber boatName')
                .populate('buyerId', 'name')
                .sort({ [filters.sortBy || 'billDate']: filters.sortOrder === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Bill.countDocuments(query)
        ]);

        return {
            data: bills,
            pagination: buildPaginationMeta(total, page, limit)
        };
    }

    /**
     * Update bill status
     * @param {string} billId - Bill ID
     * @param {Object} updateData - Update data
     * @param {Object} user - Current user
     * @returns {Promise<Object>} Updated bill
     */
    async updateBill(billId, updateData, user) {
        const bill = await Bill.findById(billId);
        if (!bill) {
            throw new Error('Bill not found');
        }

        // Check access
        this.checkBillAccess(bill, user);

        // Prevent modifications to cancelled bills
        if (bill.status === 'CANCELLED') {
            throw new Error('Cannot modify cancelled bill');
        }

        // Handle status changes
        const oldStatus = bill.status;
        const newStatus = updateData.status;

        // Update fields
        Object.keys(updateData).forEach(key => {
            if (key !== 'status') {
                bill[key] = updateData[key];
            }
        });

        // Recalculate totals if fish entries changed
        if (updateData.fishEntries) {
            let subtotal = 0;
            const fishEntries = updateData.fishEntries.map(entry => {
                const totalAmount = entry.weightKg * entry.pricePerKg;
                subtotal += totalAmount;
                return {
                    ...entry,
                    totalAmount
                };
            });
            bill.fishEntries = fishEntries;
            bill.subtotal = subtotal;
            bill.commissionAmount = (subtotal * bill.commissionRate) / 100;
            bill.grandTotal = subtotal + bill.commissionAmount;
        }

        // Update status if provided
        if (newStatus) {
            bill.status = newStatus;
        }

        await bill.save();

        // Handle ledger entries on status change
        if (newStatus === 'CONFIRMED' && oldStatus !== 'CONFIRMED') {
            await this.createLedgerEntries(bill);
        } else if (newStatus === 'CANCELLED' && oldStatus === 'CONFIRMED') {
            await this.reverseLedgerEntries(bill);
        }

        logger.info(`Bill updated: ${bill.billNumber} by user ${user._id}`);
        return bill;
    }

    /**
     * Delete bill (soft delete)
     * @param {string} billId - Bill ID
     * @param {Object} user - Current user
     * @returns {Promise<void>}
     */
    async deleteBill(billId, user) {
        const bill = await Bill.findById(billId);
        if (!bill) {
            throw new Error('Bill not found');
        }

        // Only allow deletion of draft bills
        if (bill.status !== 'DRAFT') {
            throw new Error('Cannot delete confirmed or paid bills');
        }

        bill.isDeleted = true;
        await bill.save();

        logger.info(`Bill deleted: ${bill.billNumber} by user ${user._id}`);
    }

    /**
     * Get bill summary by boat
     * @param {string} boatId - Boat ID
     * @param {Object} user - Current user
     * @returns {Promise<Object>} Bill summary
     */
    async getBillSummaryByBoat(boatId, user) {
        const boat = await Boat.findById(boatId);
        if (!boat) {
            throw new Error('Boat not found');
        }

        // Check access
        if (user.role !== 'SUPER_ADMIN' &&
            boat.agentId.toString() !== user._id.toString() &&
            boat.ownerId.toString() !== user._id.toString()) {
            throw new Error('Access denied');
        }

        const bills = await Bill.find({
            boatId,
            isDeleted: false,
            status: { $in: ['CONFIRMED', 'PAID'] }
        });

        const summary = {
            totalBills: bills.length,
            totalRevenue: bills.reduce((sum, b) => sum + b.grandTotal, 0),
            totalWeight: bills.reduce((sum, b) => {
                return sum + b.fishEntries.reduce((s, e) => s + e.weightKg, 0);
            }, 0),
            averageBillValue: bills.length > 0 ?
                bills.reduce((sum, b) => sum + b.grandTotal, 0) / bills.length : 0
        };

        return summary;
    }

    /**
     * Check if user has access to bill
     * @param {Object} bill - Bill document
     * @param {Object} user - Current user
     * @throws {Error} If access denied
     */
    checkBillAccess(bill, user) {
        if (user.role === 'SUPER_ADMIN') return true;

        const hasAccess = (
            bill.agentId.toString() === user._id.toString() ||
            bill.staffId?.toString() === user._id.toString() ||
            bill.buyerId.toString() === user._id.toString()
        );

        if (!hasAccess) {
            throw new Error('Access denied');
        }
    }

    /**
     * Apply role-based filter to query
     * @param {Object} query - MongoDB query object
     * @param {Object} user - Current user
     */
    applyRoleFilter(query, user) {
        switch (user.role) {
            case 'SUPER_ADMIN':
                // No filter
                break;
            case 'COMMISSION_AGENT':
                query.agentId = user._id;
                break;
            case 'STAFF':
                query.staffId = user._id;
                break;
            case 'FISH_BUYER':
                query.buyerId = user._id;
                break;
            case 'BOAT_OWNER':
                // Will be filtered by boat owner
                break;
            default:
                query._id = null; // No access
        }
    }

    /**
     * Create ledger entries for bill
     * @param {Object} bill - Bill document
     * @returns {Promise<void>}
     */
    async createLedgerEntries(bill) {
        // Get boat owner
        const boat = await Boat.findById(bill.boatId);
        if (!boat) {
            throw new Error('Boat not found');
        }

        // Create credit entry for boat owner (revenue)
        await ledgerService.createLedgerEntry({
            boatId: bill.boatId,
            agentId: bill.agentId,
            ownerId: boat.ownerId,
            billId: bill._id,
            type: 'CREDIT',
            amount: bill.grandTotal,
            description: `Bill ${bill.billNumber} - Fish sale`
        });
    }

    /**
     * Reverse ledger entries for cancelled bill
     * @param {Object} bill - Bill document
     * @returns {Promise<void>}
     */
    async reverseLedgerEntries(bill) {
        // Delete associated ledger entries
        await Ledger.deleteMany({ billId: bill._id });
        logger.info(`Ledger entries reversed for bill: ${bill.billNumber}`);
    }
}

module.exports = new BillService();