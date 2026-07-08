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
     * Generate bill number with proper date handling
     */
    async generateBillNumber() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const datePrefix = `${year}${month}${day}`;

        // ✅ Find the highest sequence number for today
        const latestBill = await Bill.findOne({
            billNumber: { $regex: `^INV${datePrefix}` }
        }).sort({ billNumber: -1 }).lean();

        let sequence = 1;
        if (latestBill) {
            // Extract sequence from the latest bill number
            const match = latestBill.billNumber.match(/^INV\d{8}(\d{4})$/);
            if (match) {
                sequence = parseInt(match[1]) + 1;
            } else {
                // Fallback: count all bills with today's prefix
                const count = await Bill.countDocuments({
                    billNumber: { $regex: `^INV${datePrefix}` },
                    isDeleted: false
                });
                sequence = count + 1;
            }
        }

        // ✅ Ensure uniqueness by checking if the generated number exists
        let billNumber = `INV${datePrefix}${String(sequence).padStart(4, '0')}`;
        let exists = await Bill.findOne({ billNumber, isDeleted: false });

        // ✅ If exists, increment until we find a unique one
        while (exists) {
            sequence++;
            billNumber = `INV${datePrefix}${String(sequence).padStart(4, '0')}`;
            exists = await Bill.findOne({ billNumber, isDeleted: false });
        }

        console.log(`✅ Generated unique bill number: ${billNumber}`);
        return billNumber;
    }

    /**
     * Create bill with proper date handling
     */
    async createBill(data, userId) {
        const {
            boatId,
            agentId,
            staffId,
            buyerId,
            locationId,
            subLocationId,
            fishEntries,
            notes,
            billDate
        } = data;

        // Validate boat
        const boat = await Boat.findOne({ _id: boatId, isDeleted: false });
        if (!boat) {
            throw new NotFoundError('Boat not found');
        }

        // Generate bill number
        const billNumber = await this.generateBillNumber();

        // Calculate totals
        let subtotal = 0;
        const processedEntries = [];

        if (fishEntries && Array.isArray(fishEntries)) {
            for (const entry of fishEntries) {
                const totalAmount = (entry.weightKg || 0) * (entry.pricePerKg || 0);
                subtotal += totalAmount;
                processedEntries.push({
                    ...entry,
                    totalAmount
                });
            }
        }

        // Calculate commission
        const commissionRate = 0.05; // 5% default
        const commissionAmount = subtotal * commissionRate;
        const grandTotal = subtotal + commissionAmount;

        // Handle billDate - ensure it's a Date object
        let billDateObj = new Date();
        if (billDate) {
            billDateObj = new Date(billDate);
            if (isNaN(billDateObj.getTime())) {
                throw new AppError('Invalid bill date format. Please use ISO format (YYYY-MM-DD)', 400);
            }
        }

        // Create bill
        const bill = new Bill({
            billNumber,
            boatId,
            agentId: agentId || userId,
            staffId: staffId || userId,
            buyerId,
            locationId,
            subLocationId,
            fishEntries: processedEntries,
            subtotal,
            commissionRate,
            commissionAmount,
            grandTotal,
            status: 'CONFIRMED',
            notes,
            billDate: billDateObj
        });

        await bill.save();

        // Create ledger entry
        const ledger = new Ledger({
            boatId,
            agentId: agentId || userId,
            ownerId: boat.ownerId,
            billId: bill._id,
            type: 'DEBIT',
            amount: grandTotal,
            balance: 0,
            description: `Bill ${billNumber} created`,
            date: billDateObj
        });

        await ledger.save();

        // Populate references
        const populatedBill = await Bill.findById(bill._id)
            .populate('boatId', 'boatNumber boatName')
            .populate('agentId', 'name email')
            .populate('staffId', 'name email')
            .populate('buyerId', 'name email')
            .populate('locationId', 'name')
            .populate('subLocationId', 'name');

        logger.info(`Bill created: ${billNumber} for boat ${boat.boatNumber}`);
        return populatedBill;
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
            .populate('agentId', 'name email')   // ✅ ADD THIS
            .populate('staffId', 'name email')   // ✅ ADD THIS
            .populate('buyerId', 'name email')
            .populate('locationId', 'name')
            .populate('subLocationId', 'name')
            .lean();

        if (!bill) {
            throw new Error('Bill not found');
        }

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
        await this.applyRoleFilter(query, user);

        // Apply additional filters
        if (filters.boatId) query.boatId = filters.boatId;
        if (filters.agentId) query.agentId = filters.agentId;
        if (filters.buyerId) query.buyerId = filters.buyerId;
        if (filters.locationId) query.locationId = filters.locationId;
        if (filters.status) query.status = filters.status;

        // ✅ Handle date filtering - Single Date OR Date Range
        if (filters.date) {
            // Single date filter
            const singleDate = new Date(filters.date);
            singleDate.setHours(0, 0, 0, 0);
            const endOfDay = new Date(singleDate);
            endOfDay.setHours(23, 59, 59, 999);
            query.billDate = { $gte: singleDate, $lte: endOfDay };
        } else {
            // Date range filter
            if (filters.fromDate) {
                query.billDate = { $gte: new Date(filters.fromDate) };
            }
            if (filters.toDate) {
                const toDate = new Date(filters.toDate);
                toDate.setHours(23, 59, 59, 999);
                query.billDate = { ...query.billDate, $lte: toDate };
            }
        }

        if (filters.search) {
            const searchQuery = [
                { billNumber: { $regex: filters.search, $options: 'i' } },
                { 'boatId.boatNumber': { $regex: filters.search, $options: 'i' } }
            ];
            if (query.$or) {
                const roleFilter = { $or: query.$or };
                delete query.$or;
                query.$and = [
                    roleFilter,
                    { $or: searchQuery }
                ];
            } else {
                query.$or = searchQuery;
            }
        }

        const [bills, total] = await Promise.all([
            Bill.find(query)
                .populate('boatId', 'boatNumber boatName')
                .populate('agentId', 'name email')
                .populate('staffId', 'name email')
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

        // ✅ Allow deletion of CONFIRMED bills (not just DRAFT)
        if (bill.status === 'CANCELLED') {
            throw new Error('Cannot delete cancelled bill');
        }

        bill.isDeleted = true;
        await bill.save();

        // ✅ Reverse ledger entries if bill was confirmed
        if (bill.status === 'CONFIRMED') {
            await this.reverseLedgerEntries(bill);
        }

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
    async applyRoleFilter(query, user) {
        switch (user.role) {
            case 'SUPER_ADMIN':
                // No filter
                break;
            case 'COMMISSION_AGENT':
                // Commission agent sees their own bills AND bills created by their staff
                const User = require('../models/usermodel');
                const staff = await User.find({ agentId: user._id, role: 'STAFF', isActive: true, isDeleted: false }).select('_id').lean();
                const staffIds = staff.map(s => s._id);
                query.$or = [
                    { agentId: user._id },
                    { staffId: { $in: staffIds } }
                ];
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