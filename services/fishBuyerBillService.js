const FishBuyerBill = require('../models/fishBuyerBillModel');
const User = require('../models/usermodel');
const Fish = require('../models/fishmodel');
const logger = require('../config/logger');

class FishBuyerBillService {
    /**
     * Generate bill number for fish buyer bills
     */
    async generateBillNumber() {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const datePrefix = `FBB${year}${month}${day}`;

        const latestBill = await FishBuyerBill.findOne({
            billNumber: { $regex: `^${datePrefix}` }
        }).sort({ billNumber: -1 }).lean();

        let sequence = 1;
        if (latestBill) {
            const match = latestBill.billNumber.match(/^FBB\d{8}(\d{4})$/);
            if (match) {
                sequence = parseInt(match[1]) + 1;
            } else {
                const count = await FishBuyerBill.countDocuments({
                    billNumber: { $regex: `^${datePrefix}` },
                    isDeleted: false
                });
                sequence = count + 1;
            }
        }

        let billNumber = `${datePrefix}${String(sequence).padStart(4, '0')}`;
        let exists = await FishBuyerBill.findOne({ billNumber, isDeleted: false });
        while (exists) {
            sequence++;
            billNumber = `${datePrefix}${String(sequence).padStart(4, '0')}`;
            exists = await FishBuyerBill.findOne({ billNumber, isDeleted: false });
        }

        return billNumber;
    }

    /**
     * Create a fish buyer bill
     */
    async createBill(data, userId) {
        const { agentId, fishId, fishName, weightKg, pricePerKg, notes } = data;

        if (!weightKg || weightKg <= 0) {
            throw new Error('Weight must be greater than 0');
        }
        if (!pricePerKg || pricePerKg <= 0) {
            throw new Error('Price per KG must be greater than 0');
        }

        // Validate agent exists
        const agent = await User.findOne({
            _id: agentId,
            role: 'COMMISSION_AGENT',
            isActive: true,
            isDeleted: false
        });
        if (!agent) {
            throw new Error('Invalid or inactive commission agent');
        }

        // Validate buyer exists
        const buyer = await User.findOne({
            _id: userId,
            role: 'FISH_BUYER',
            isActive: true,
            isDeleted: false
        });
        if (!buyer) {
            throw new Error('Buyer not found or inactive');
        }

        // Validate fish if fishId provided
        let resolvedFishName = fishName;
        if (fishId) {
            const fish = await Fish.findOne({ _id: fishId, isDeleted: false });
            if (fish) {
                resolvedFishName = fish.name;
            }
        }

        const totalAmount = weightKg * pricePerKg;
        const billNumber = await this.generateBillNumber();

        const bill = new FishBuyerBill({
            billNumber,
            buyerId: userId,
            agentId,
            fishId: fishId || undefined,
            fishName: resolvedFishName || 'Unknown Fish',
            weightKg,
            pricePerKg,
            totalAmount,
            notes: notes || undefined,
            billDate: new Date()
        });

        await bill.save();

        const populatedBill = await FishBuyerBill.findById(bill._id)
            .populate('agentId', 'name email')
            .populate('buyerId', 'name email')
            .populate('fishId', 'name')
            .lean();

        logger.info(`Fish Buyer Bill created: ${billNumber} by buyer ${userId}`);
        return populatedBill;
    }

    /**
     * Get fish buyer bills with filters
     */
    async getBills(filters, pagination, user) {
        const { page, limit, skip } = pagination;
        const query = { isDeleted: false };

        // Role-based filtering
        if (user.role === 'FISH_BUYER') {
            query.buyerId = user._id;
        } else if (user.role === 'COMMISSION_AGENT') {
            query.agentId = user._id;
        } else if (user.role !== 'SUPER_ADMIN') {
            query._id = null; // No access
        }

        if (filters.agentId) query.agentId = filters.agentId;
        if (filters.buyerId) query.buyerId = filters.buyerId;
        if (filters.status) query.status = filters.status;

        if (filters.fromDate || filters.toDate) {
            query.billDate = {};
            if (filters.fromDate) query.billDate.$gte = new Date(filters.fromDate);
            if (filters.toDate) {
                const toDate = new Date(filters.toDate);
                toDate.setHours(23, 59, 59, 999);
                query.billDate.$lte = toDate;
            }
        }

        const [bills, total] = await Promise.all([
            FishBuyerBill.find(query)
                .populate('agentId', 'name email')
                .populate('buyerId', 'name email')
                .populate('fishId', 'name')
                .sort({ billDate: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            FishBuyerBill.countDocuments(query)
        ]);

        return { data: bills, total };
    }

    /**
     * Get bill by ID
     */
    async getBillById(billId, user) {
        const bill = await FishBuyerBill.findById(billId)
            .populate('agentId', 'name email')
            .populate('buyerId', 'name email')
            .populate('fishId', 'name')
            .lean();

        if (!bill) {
            throw new Error('Bill not found');
        }

        // Check access
        if (user.role !== 'SUPER_ADMIN' &&
            bill.buyerId?._id?.toString() !== user._id.toString() &&
            bill.agentId?._id?.toString() !== user._id.toString()) {
            throw new Error('Access denied');
        }

        return bill;
    }

    /**
     * Get fish buyer bills for agent dashboard
     */
    async getBillsByAgent(agentId, user) {
        if (user.role !== 'SUPER_ADMIN' && user._id.toString() !== agentId) {
            throw new Error('Access denied');
        }

        const bills = await FishBuyerBill.find({
            agentId,
            isDeleted: false,
            status: 'CONFIRMED'
        })
            .populate('buyerId', 'name email')
            .populate('fishId', 'name')
            .sort({ billDate: -1 })
            .limit(50)
            .lean();

        return bills;
    }

    /**
     * Cancel a fish buyer bill
     */
    async cancelBill(billId, user) {
        const bill = await FishBuyerBill.findById(billId);
        if (!bill) {
            throw new Error('Bill not found');
        }

        if (bill.buyerId.toString() !== user._id.toString() && user.role !== 'SUPER_ADMIN') {
            throw new Error('Access denied');
        }

        if (bill.status === 'CANCELLED') {
            throw new Error('Bill is already cancelled');
        }

        bill.status = 'CANCELLED';
        await bill.save();

        logger.info(`Fish Buyer Bill cancelled: ${bill.billNumber}`);
        return bill;
    }

    /**
     * Delete bill (soft delete)
     */
    async deleteBill(billId, user) {
        const bill = await FishBuyerBill.findById(billId);
        if (!bill) {
            throw new Error('Bill not found');
        }

        if (bill.buyerId.toString() !== user._id.toString() && user.role !== 'SUPER_ADMIN') {
            throw new Error('Access denied');
        }

        bill.isDeleted = true;
        await bill.save();

        logger.info(`Fish Buyer Bill deleted: ${bill.billNumber}`);
    }
}

module.exports = new FishBuyerBillService();