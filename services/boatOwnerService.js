const mongoose = require('mongoose');
const Bill = require('../models/billmodel');
const Boat = require('../models/boatmodel');
const BoatOwnerLedger = require('../models/boatOwnerLedgermodel');
const FishingLocation = require('../models/fishingLocationmodel');
const User = require('../models/usermodel');
const Location = require('../models/locationmodel');
const logger = require('../config/logger');

class BoatOwnerService {
    
    // ─── Helpers ────────────────────────────────────────────
    
    async getOwnerBoatIds(ownerId) {
        const boats = await Boat.find({ 
            ownerId, 
            isDeleted: false, 
            isActive: true 
        }).select('_id').lean();
        return boats.map(b => b._id);
    }

    toMidnight(date) {
        const d = new Date(date);
        d.setUTCHours(0, 0, 0, 0);
        return d;
    }

    // ─── Dashboard ──────────────────────────────────────────
    
    async getDashboard(ownerId) {
        const boatIds = await this.getOwnerBoatIds(ownerId);
        const now = new Date();

        // Date boundaries
        const todayStart = this.toMidnight(now);
        const todayEnd = new Date(todayStart);
        todayEnd.setUTCHours(23, 59, 59, 999);

        const weekStart = new Date(todayStart);
        weekStart.setUTCDate(weekStart.getUTCDate() - 6);
        
        const monthStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);

        const baseBillQuery = { 
            boatId: { $in: boatIds }, 
            isDeleted: false, 
            status: 'CONFIRMED' 
        };

        // Get all bills
        const allBills = await Bill.find(baseBillQuery).lean();

        // Filter bills by date ranges
        const todayBills = allBills.filter(b => {
            const bd = new Date(b.billDate);
            return bd >= todayStart && bd <= todayEnd;
        });

        const weekBills = allBills.filter(b => {
            const bd = new Date(b.billDate);
            return bd >= weekStart && bd <= todayEnd;
        });

        const monthBills = allBills.filter(b => {
            const bd = new Date(b.billDate);
            return bd >= monthStart && bd <= todayEnd;
        });

        const totalBoats = await Boat.countDocuments({ 
            ownerId, 
            isDeleted: false, 
            isActive: true 
        });

        // Sum helpers
        const sumGrandTotal = arr => arr.reduce((s, b) => s + (b.grandTotal || 0), 0);
        const sumWeight = arr => arr.reduce((s, b) => 
            s + (b.fishEntries || []).reduce((ws, fe) => ws + (fe.weightKg || 0), 0), 0);

        // Revenue chart - last 7 days
        const chartData = [];
        for (let i = 6; i >= 0; i--) {
            const dayStart = new Date(todayStart);
            dayStart.setUTCDate(dayStart.getUTCDate() - i);
            const dayEnd = new Date(dayStart);
            dayEnd.setUTCHours(23, 59, 59, 999);
            
            const dayBills = weekBills.filter(b => {
                const bd = new Date(b.billDate);
                return bd >= dayStart && bd <= dayEnd;
            });
            
            chartData.push({
                date: dayStart.toISOString().slice(0, 10),
                revenue: sumGrandTotal(dayBills),
                billCount: dayBills.length,
            });
        }

        // Boat performance
        const allBoats = await Boat.find({ ownerId, isDeleted: false })
            .populate('locationId', 'name')
            .populate('subLocationId', 'name')
            .lean();

        // Today's fishing locations
        const todayLocations = await FishingLocation.find({
            ownerId,
            date: { $gte: todayStart, $lte: todayEnd }
        }).lean();
        
        const locationMap = {};
        todayLocations.forEach(l => { 
            locationMap[l.boatId.toString()] = l; 
        });

        const boatPerformance = allBoats.map(boat => {
            const boatBills = allBills.filter(b => 
                b.boatId.toString() === boat._id.toString()
            );
            return {
                boatId: boat._id,
                boatNumber: boat.boatNumber,
                boatName: boat.boatName,
                isActive: boat.isActive,
                location: boat.locationId,
                subLocation: boat.subLocationId,
                totalBills: boatBills.length,
                totalRevenue: sumGrandTotal(boatBills),
                totalWeight: sumWeight(boatBills),
                todayLocation: locationMap[boat._id.toString()] || null,
                locationStatus: locationMap[boat._id.toString()] ? 'SAVED' : 'PENDING',
            };
        });

        // Top selling fish
        const fishMap = {};
        allBills.forEach(bill => {
            (bill.fishEntries || []).forEach(fe => {
                const name = fe.fishName || 'Unknown';
                if (!fishMap[name]) {
                    fishMap[name] = { 
                        fishName: name, 
                        totalWeight: 0, 
                        totalAmount: 0, 
                        count: 0 
                    };
                }
                fishMap[name].totalWeight += fe.weightKg || 0;
                fishMap[name].totalAmount += fe.totalAmount || 0;
                fishMap[name].count += 1;
            });
        });
        
        const topFish = Object.values(fishMap)
            .sort((a, b) => b.totalWeight - a.totalWeight)
            .slice(0, 10);

        return {
            summary: {
                todayRevenue: sumGrandTotal(todayBills),
                weeklyRevenue: sumGrandTotal(weekBills),
                monthlyRevenue: sumGrandTotal(monthBills),
                totalBoats,
                todayBillCount: todayBills.length,
                totalWeightSold: sumWeight(allBills),
            },
            revenueChart: chartData,
            boatPerformance,
            topFish,
        };
    }

    // ─── Bills (Read-Only) ───────────────────────────────────
    
    async getBills(ownerId, filters, pagination) {
        const boatIds = await this.getOwnerBoatIds(ownerId);
        const { page, limit, skip } = pagination;
        const { boatId, fromDate, toDate, createdBy, fishName } = filters;

        const query = {
            boatId: { $in: boatIds },
            isDeleted: false,
        };

        if (boatId && boatIds.map(String).includes(String(boatId))) {
            query.boatId = boatId;
        }

        if (fromDate || toDate) {
            query.billDate = {};
            if (fromDate) query.billDate.$gte = new Date(fromDate);
            if (toDate) {
                const to = new Date(toDate);
                to.setUTCHours(23, 59, 59, 999);
                query.billDate.$lte = to;
            }
        }

        if (createdBy) {
            query.$or = [
                { agentId: createdBy },
                { staffId: createdBy },
            ];
        }

        if (fishName) {
            query['fishEntries.fishName'] = { $regex: fishName, $options: 'i' };
        }

        const [bills, total] = await Promise.all([
            Bill.find(query)
                .populate('boatId', 'boatNumber boatName')
                .populate('agentId', 'name email')
                .populate('staffId', 'name email')
                .sort({ billDate: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Bill.countDocuments(query),
        ]);

        return { data: bills, total };
    }

    async getBillById(billId, ownerId) {
        const boatIds = await this.getOwnerBoatIds(ownerId);

        const bill = await Bill.findOne({
            _id: billId,
            boatId: { $in: boatIds },
            isDeleted: false,
        })
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

        return bill;
    }

    // ─── Ledger ──────────────────────────────────────────────
    
    async getLedgerSummary(ownerId, filters = {}) {
        const boatIds = await this.getOwnerBoatIds(ownerId);
        const { boatId, fromDate, toDate } = filters;

        const match = { ownerId: new mongoose.Types.ObjectId(ownerId.toString()) };
        
        if (boatId && boatIds.map(String).includes(String(boatId))) {
            match.boatId = new mongoose.Types.ObjectId(boatId);
        } else {
            match.boatId = { $in: boatIds };
        }
        
        if (fromDate) match.date = { $gte: new Date(fromDate) };
        if (toDate) {
            const to = new Date(toDate);
            to.setUTCHours(23, 59, 59, 999);
            match.date = { ...(match.date || {}), $lte: to };
        }

        const result = await BoatOwnerLedger.aggregate([
            { $match: match },
            {
                $group: {
                    _id: '$type',
                    total: { $sum: '$amount' },
                },
            },
        ]);

        let totalIncome = 0, totalExpense = 0;
        result.forEach(r => {
            if (r._id === 'INCOME') totalIncome = r.total;
            if (r._id === 'EXPENSE') totalExpense = r.total;
        });

        return {
            totalIncome,
            totalExpense,
            netProfit: totalIncome - totalExpense,
        };
    }

    async getLedgerEntries(ownerId, filters, pagination) {
        const boatIds = await this.getOwnerBoatIds(ownerId);
        const { page, limit, skip } = pagination;
        const { boatId, type, category, fromDate, toDate } = filters;

        const query = {
            ownerId,
            boatId: { $in: boatIds },
        };

        if (boatId && boatIds.map(String).includes(String(boatId))) {
            query.boatId = boatId;
        }
        if (type) query.type = type;
        if (category) query.category = category;
        if (fromDate) query.date = { $gte: new Date(fromDate) };
        if (toDate) {
            const to = new Date(toDate);
            to.setUTCHours(23, 59, 59, 999);
            query.date = { ...(query.date || {}), $lte: to };
        }

        const [entries, total] = await Promise.all([
            BoatOwnerLedger.find(query)
                .populate('boatId', 'boatNumber boatName')
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            BoatOwnerLedger.countDocuments(query),
        ]);

        return { data: entries, total };
    }

    async createLedgerEntry(ownerId, data) {
        const { boatId, date, type, category, amount, description } = data;

        // Verify boat belongs to owner
        const boat = await Boat.findOne({ _id: boatId, ownerId, isDeleted: false });
        if (!boat) {
            throw new Error('Boat not found or does not belong to you');
        }

        const entry = new BoatOwnerLedger({
            boatId,
            ownerId,
            date: date ? new Date(date) : new Date(),
            type,
            category,
            amount,
            description: description || '',
        });
        
        await entry.save();
        await entry.populate('boatId', 'boatNumber boatName');

        return entry;
    }

    async updateLedgerEntry(entryId, ownerId, data) {
        const entry = await BoatOwnerLedger.findOne({ _id: entryId, ownerId });
        if (!entry) {
            throw new Error('Ledger entry not found');
        }

        const allowed = ['date', 'type', 'category', 'amount', 'description', 'boatId'];
        allowed.forEach(field => {
            if (data[field] !== undefined) entry[field] = data[field];
        });

        await entry.save();
        await entry.populate('boatId', 'boatNumber boatName');
        return entry;
    }

    async deleteLedgerEntry(entryId, ownerId) {
        const entry = await BoatOwnerLedger.findOneAndDelete({ _id: entryId, ownerId });
        if (!entry) {
            throw new Error('Ledger entry not found');
        }
        return entry;
    }

    // ─── Fishing Locations ───────────────────────────────────
    
    async saveFishingLocation(ownerId, data) {
    const { boatId, date, latitude, longitude } = data;

    // Verify boat belongs to owner
    const boat = await Boat.findOne({ _id: boatId, ownerId, isDeleted: false });
    if (!boat) {
        throw new Error('Boat not found or does not belong to you');
    }

    // Normalize date to midnight UTC
    const locationDate = this.toMidnight(date ? new Date(date) : new Date());

    // ✅ UPSERT: Find existing record for this boat + date, update or create new
    const location = await FishingLocation.findOneAndUpdate(
        { 
            boatId: boatId, 
            date: locationDate,
            ownerId: ownerId  // Ensure owner owns it
        },
        { 
            $set: { 
                latitude: latitude, 
                longitude: longitude,
                ownerId: ownerId
            } 
        },
        { 
            upsert: true,      // Create if doesn't exist
            new: true,         // Return updated document
            setDefaultsOnInsert: true 
        }
    ).populate('boatId', 'boatNumber boatName');

    logger.info(`Fishing location ${location._id ? 'updated' : 'created'} for boat ${boatId} on ${date}`);
    
    return location;
}

    async getFishingLocations(ownerId, filters, pagination) {
        const boatIds = await this.getOwnerBoatIds(ownerId);
        const { page, limit, skip } = pagination;
        const { boatId, fromDate, toDate } = filters;

        const query = { boatId: { $in: boatIds } };

        if (boatId && boatIds.map(String).includes(String(boatId))) {
            query.boatId = boatId;
        }
        if (fromDate) query.date = { $gte: this.toMidnight(new Date(fromDate)) };
        if (toDate) {
            const to = new Date(toDate);
            to.setUTCHours(23, 59, 59, 999);
            query.date = { ...(query.date || {}), $lte: to };
        }

        const [locations, total] = await Promise.all([
            FishingLocation.find(query)
                .populate('boatId', 'boatNumber boatName')
                .sort({ date: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            FishingLocation.countDocuments(query),
        ]);

        return { data: locations, total };
    }

    async deleteFishingLocation(locationId, ownerId) {
        const boatIds = await this.getOwnerBoatIds(ownerId);
        const location = await FishingLocation.findOneAndDelete({
            _id: locationId,
            boatId: { $in: boatIds },
        });

        if (!location) {
            throw new Error('Fishing location not found');
        }
        return location;
    }

    // ─── Profile ─────────────────────────────────────────────
    
    async getProfile(ownerId) {
        const boatIds = await this.getOwnerBoatIds(ownerId);

        const [user, totalBoats, allBills] = await Promise.all([
            User.findById(ownerId).select('-password -refreshTokens').lean(),
            Boat.countDocuments({ ownerId, isDeleted: false, isActive: true }),
            Bill.find({
                boatId: { $in: boatIds },
                isDeleted: false,
                status: 'CONFIRMED',
            }).select('grandTotal').lean(),
        ]);

        const totalRevenue = allBills.reduce((s, b) => s + (b.grandTotal || 0), 0);

        let locationName = null;
        if (user.locationId) {
            try {
                const loc = await Location.findById(user.locationId).select('name').lean();
                if (loc) locationName = loc.name;
            } catch (_) { /* ignore */ }
        }

        return {
            ...user,
            locationName,
            stats: {
                totalBoats,
                totalRevenue,
            },
        };
    }
}

module.exports = new BoatOwnerService();