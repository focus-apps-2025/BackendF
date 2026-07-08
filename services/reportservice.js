const Bill = require('../models/billmodel');
const AuditLog = require('../models/auditLogmodel');
const Location = require('../models/locationmodel');
const Fish = require('../models/fishmodel');
const logger = require('../config/logger');

class ReportService {
    /**
     * Get revenue report with date range
     * @param {Object} filters - Filter parameters (fromDate, toDate)
     * @param {Object} user - Current user
     * @returns {Promise<Object>} Revenue report
     */
    async getRevenueReport(filters, user) {
        this.validateDateRange(filters);

        const { fromDate, toDate } = this.getDateRange(filters);

        const matchQuery = {
            status: 'CONFIRMED',
            billDate: { $gte: fromDate, $lte: toDate },
            isDeleted: false
        };

        // Apply role-based filtering
        await this.applyRoleFilter(matchQuery, user);

        const revenueData = await Bill.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$grandTotal' },
                    totalBills: { $sum: 1 },
                    averageBillValue: { $avg: '$grandTotal' },
                    totalWeight: { $sum: { $sum: '$fishEntries.weightKg' } },
                    totalCommission: { $sum: '$commissionAmount' },
                    maxBillValue: { $max: '$grandTotal' },
                    minBillValue: { $min: '$grandTotal' }
                }
            },
            {
                $project: {
                    _id: 0,
                    totalRevenue: 1,
                    totalBills: 1,
                    averageBillValue: 1,
                    totalWeight: 1,
                    totalCommission: 1,
                    maxBillValue: 1,
                    minBillValue: 1
                }
            }
        ]);

        // Get daily breakdown (sparse — only days with bills)
        const dailyData = await Bill.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: '%Y-%m-%d',
                            date: '$billDate',
                            timezone: 'Asia/Kolkata'   // ✅ group by IST day, not UTC
                        }
                    },
                    date: { $first: '$billDate' },
                    revenue: { $sum: '$grandTotal' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    _id: 0,
                    date: 1,
                    revenue: 1,
                    count: 1
                }
            }
        ]);

        // ✅ Zero-fill missing days so the trend always covers the full range
        const denseDaily = this.fillMissingDates(dailyData, fromDate, toDate);

        return {
            summary: revenueData[0] || {
                totalRevenue: 0,
                totalBills: 0,
                averageBillValue: 0,
                totalWeight: 0,
                totalCommission: 0,
                maxBillValue: 0,
                minBillValue: 0
            },
            daily: denseDaily,
            period: {
                fromDate,
                toDate
            }
        };
    }

    /**
     * Get revenue by fish type
     * @param {Object} filters - Filter parameters (fromDate, toDate)
     * @param {Object} user - Current user
     * @returns {Promise<Array>} Revenue by fish
     */
    async getRevenueByFish(filters, user) {
        this.validateDateRange(filters);

        const { fromDate, toDate } = this.getDateRange(filters);

        const matchQuery = {
            status: 'CONFIRMED',
            billDate: { $gte: fromDate, $lte: toDate },
            isDeleted: false
        };
        await this.applyRoleFilter(matchQuery, user);

        // ✅ Current period: includes min/max price now
        const fishRevenue = await Bill.aggregate([
            { $match: matchQuery },
            { $unwind: '$fishEntries' },
            {
                $group: {
                    _id: '$fishEntries.fishId',
                    fishName: { $first: '$fishEntries.fishName' },
                    totalRevenue: { $sum: '$fishEntries.totalAmount' },
                    totalWeight: { $sum: '$fishEntries.weightKg' },
                    count: { $sum: 1 },
                    averagePrice: { $avg: '$fishEntries.pricePerKg' },
                    lowestPrice: { $min: '$fishEntries.pricePerKg' },   // ✅ new
                    highestPrice: { $max: '$fishEntries.pricePerKg' },  // ✅ new
                }
            },
            {
                $lookup: {
                    from: 'fish',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'fishDetails'
                }
            },
            { $unwind: { path: '$fishDetails', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 0,
                    fishId: '$_id',
                    fishName: 1,
                    category: '$fishDetails.category',
                    totalRevenue: 1,
                    totalWeight: 1,
                    count: 1,
                    averagePrice: 1,
                    lowestPrice: 1,
                    highestPrice: 1
                }
            },
            { $sort: { totalRevenue: -1 } }
        ]);

        // ✅ Previous period of equal length, immediately before fromDate,
        // used only to compute the price trend (Rising/Falling %).
        const rangeLengthMs = toDate.getTime() - fromDate.getTime();
        const prevToDate = new Date(fromDate.getTime() - 1); // 1ms before current range starts
        const prevFromDate = new Date(prevToDate.getTime() - rangeLengthMs);

        const prevMatchQuery = {
            status: 'CONFIRMED',
            billDate: { $gte: prevFromDate, $lte: prevToDate },
            isDeleted: false
        };
        await this.applyRoleFilter(prevMatchQuery, user);

        const prevFishPrices = await Bill.aggregate([
            { $match: prevMatchQuery },
            { $unwind: '$fishEntries' },
            {
                $group: {
                    _id: '$fishEntries.fishId',
                    averagePrice: { $avg: '$fishEntries.pricePerKg' }
                }
            }
        ]);

        // Map fishId -> previous average price, for quick lookup
        const prevPriceMap = new Map(
            prevFishPrices.map(p => [String(p._id), p.averagePrice])
        );

        // ✅ Attach trend info to each fish (null if no previous-period data to compare)
        const fishRevenueWithTrend = fishRevenue.map(fish => {
            const prevAvg = prevPriceMap.get(String(fish.fishId));
            let priceChangePercent = null;
            let isRising = null;

            if (prevAvg && prevAvg > 0) {
                priceChangePercent = ((fish.averagePrice - prevAvg) / prevAvg) * 100;
                isRising = priceChangePercent >= 0;
            }

            return {
                ...fish,
                priceChangePercent,
                isRising
            };
        });

        return fishRevenueWithTrend;
    }

    /**
     * Get revenue by location
     * @param {Object} filters - Filter parameters (fromDate, toDate)
     * @param {Object} user - Current user
     * @returns {Promise<Array>} Revenue by location
     */
    async getRevenueByLocation(filters, user) {
        this.validateDateRange(filters);

        const { fromDate, toDate } = this.getDateRange(filters);

        const matchQuery = {
            status: 'CONFIRMED',
            billDate: { $gte: fromDate, $lte: toDate },
            isDeleted: false
        };

        await this.applyRoleFilter(matchQuery, user);

        const locationRevenue = await Bill.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: {
                        locationId: '$locationId',
                        subLocationId: '$subLocationId'
                    },
                    totalRevenue: { $sum: '$grandTotal' },
                    totalBills: { $sum: 1 },
                    totalWeight: { $sum: { $sum: '$fishEntries.weightKg' } }
                }
            },
            {
                $lookup: {
                    from: 'locations',
                    localField: '_id.locationId',
                    foreignField: '_id',
                    as: 'location'
                }
            },
            { $unwind: { path: '$location', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'sublocations',
                    localField: '_id.subLocationId',
                    foreignField: '_id',
                    as: 'subLocation'
                }
            },
            { $unwind: { path: '$subLocation', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 0,
                    locationId: '$_id.locationId',
                    locationName: '$location.name',
                    subLocationId: '$_id.subLocationId',
                    subLocationName: '$subLocation.name',
                    totalRevenue: 1,
                    totalBills: 1,
                    totalWeight: 1
                }
            },
            { $sort: { totalRevenue: -1 } }
        ]);

        return locationRevenue;
    }

    /**
     * Get bills summary
     * @param {Object} filters - Filter parameters (fromDate, toDate)
     * @param {Object} user - Current user
     * @returns {Promise<Object>} Bills summary
     */
    async getBillsSummary(filters, user) {
        this.validateDateRange(filters);

        const { fromDate, toDate } = this.getDateRange(filters);

        const matchQuery = {
            billDate: { $gte: fromDate, $lte: toDate },
            isDeleted: false
        };

        await this.applyRoleFilter(matchQuery, user);

        const summary = await Bill.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalRevenue: { $sum: '$grandTotal' },
                    totalWeight: { $sum: { $sum: '$fishEntries.weightKg' } }
                }
            },
            {
                $project: {
                    _id: 0,
                    status: '$_id',
                    count: 1,
                    totalRevenue: 1,
                    totalWeight: 1
                }
            }
        ]);

        // Get payment method breakdown
        const paymentMethodSummary = await Bill.aggregate([
            {
                $match: {
                    ...matchQuery,
                    status: { $in: ['CONFIRMED', 'PAID'] }
                }
            },
            {
                $group: {
                    _id: '$paymentMethod',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$grandTotal' }
                }
            },
            {
                $project: {
                    _id: 0,
                    paymentMethod: '$_id',
                    count: 1,
                    totalAmount: 1
                }
            }
        ]);

        // Get total counts
        const totalCounts = await Bill.aggregate([
            { $match: matchQuery },
            {
                $group: {
                    _id: null,
                    totalBills: { $sum: 1 },
                    totalRevenue: { $sum: '$grandTotal' },
                    totalWeight: { $sum: { $sum: '$fishEntries.weightKg' } }
                }
            }
        ]);

        return {
            summary: {
                byStatus: summary,
                byPaymentMethod: paymentMethodSummary,
                total: totalCounts[0] || {
                    totalBills: 0,
                    totalRevenue: 0,
                    totalWeight: 0
                }
            },
            period: {
                fromDate,
                toDate
            }
        };
    }

    /**
     * Get audit logs with pagination and filters
     * @param {Object} filters - Filter parameters
     * @param {Object} pagination - Pagination parameters
     * @param {Object} user - Current user
     * @returns {Promise<Object>} Audit logs with pagination
     */
    async getAuditLogs(filters, pagination, user) {
        // Only SUPER_ADMIN can view audit logs
        if (user.role !== 'SUPER_ADMIN') {
            throw new Error('Access denied. Only super admins can view audit logs');
        }

        const { page, limit, skip } = pagination;

        const query = {};

        if (filters.userId) query.userId = filters.userId;
        if (filters.action) query.action = filters.action;
        if (filters.resource) query.resource = filters.resource;
        if (filters.fromDate) {
            query.timestamp = { $gte: new Date(filters.fromDate) };
        }
        if (filters.toDate) {
            query.timestamp = { ...query.timestamp, $lte: new Date(filters.toDate) };
        }

        const [logs, total] = await Promise.all([
            AuditLog.find(query)
                .populate('userId', 'name email role')
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            AuditLog.countDocuments(query)
        ]);

        return {
            data: logs,
            total
        };
    }


    // services/reportservice.js

    /**
     * Validate date range
     * @param {Object} filters - Filter parameters
     * @throws {Error} If dates are invalid
     */
    validateDateRange(filters) {
        if (!filters.fromDate || !filters.toDate) {
            throw new Error('Both fromDate and toDate are required');
        }

        // ✅ Compare the date strings (YYYY-MM-DD) directly
        const fromStr = filters.fromDate.split('T')[0]; // Get just YYYY-MM-DD
        const toStr = filters.toDate.split('T')[0];   // Get just YYYY-MM-DD

        // ✅ If same day, it's valid
        if (fromStr === toStr) {
            return; // ✅ Same day is always valid
        }

        const fromDate = new Date(filters.fromDate);
        const toDate = new Date(filters.toDate);

        if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
            throw new Error('Invalid date format');
        }

        if (fromDate > toDate) {
            throw new Error('From date must be before to date');
        }

        const diffDays = (toDate - fromDate) / (1000 * 60 * 60 * 24);
        if (diffDays > 365) {
            throw new Error('Date range cannot exceed 365 days');
        }
    }

    /**
    * Format a Date as YYYY-MM-DD in a fixed timezone (Asia/Kolkata),
    * regardless of the server's local TZ setting.
    */
    formatDateKey(date, timeZone = 'Asia/Kolkata') {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(date); // en-CA locale conveniently outputs YYYY-MM-DD
    }

    /**
     * Fill in missing dates within a range with zero-value entries.
     * Walks by fixed 24h increments (safe — India has no DST) and keys
     * everything by IST calendar day so it matches the aggregation above.
     */
    fillMissingDates(dailyData, fromDate, toDate) {
        const result = [];
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;

        const dataMap = new Map(
            dailyData.map(d => [this.formatDateKey(d.date), d])
        );

        let cursor = new Date(fromDate);

        while (cursor <= toDate) {
            const key = this.formatDateKey(cursor);
            if (dataMap.has(key)) {
                result.push(dataMap.get(key));
            } else {
                result.push({ date: new Date(cursor), revenue: 0, count: 0 });
            }
            cursor = new Date(cursor.getTime() + ONE_DAY_MS);
        }

        return result;
    }
    /**
     * Get date range from filters
     * @param {Object} filters - Filter parameters
     * @returns {Object} Date range
     */
    getDateRange(filters) {
        const fromDate = new Date(filters.fromDate);
        fromDate.setHours(0, 0, 0, 0);

        const toDate = new Date(filters.toDate);
        toDate.setHours(23, 59, 59, 999);

        // ✅ If same day, set toDate to end of day
        const isSameDay = fromDate.getFullYear() === toDate.getFullYear() &&
            fromDate.getMonth() === toDate.getMonth() &&
            fromDate.getDate() === toDate.getDate();

        if (isSameDay) {
            // Ensure toDate covers the entire day
            toDate.setHours(23, 59, 59, 999);
        }

        return { fromDate, toDate };
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
                const staffIds = await this._getStaffIds(user._id);
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
                // Boat owners can only see their own boat bills
                // This will be handled separately in the controller
                break;
            default:
                query._id = null; // No access
        }
    }

    /**
     * Get staff user IDs for a commission agent
     * @param {ObjectId} agentId - Commission agent ID
     * @returns {Promise<Array>} Array of staff user IDs
     */
    async _getStaffIds(agentId) {
        const User = require('../models/usermodel');
        const staff = await User.find({ agentId, role: 'STAFF', isActive: true, isDeleted: false }).select('_id').lean();
        return staff.map(s => s._id);
    }

    /**
     * Export report data to CSV format
     * @param {Array} data - Report data
     * @param {Array} headers - CSV headers
     * @returns {string} CSV string
     */
    exportToCSV(data, headers) {
        if (!data || data.length === 0) return '';

        const csvRows = [];

        // Add headers
        csvRows.push(headers.join(','));

        // Add data rows
        data.forEach(row => {
            const values = headers.map(header => {
                const value = row[header] || '';
                // Escape commas and quotes
                return `"${String(value).replace(/"/g, '""')}"`;
            });
            csvRows.push(values.join(','));
        });

        return csvRows.join('\n');
    }

    /**
     * Get dashboard summary for all widgets
     * @param {Object} filters - Filter parameters (fromDate, toDate)
     * @param {Object} user - Current user
     * @returns {Promise<Object>} Dashboard summary
     */
    async getDashboardSummary(filters, user) {
        const { fromDate, toDate } = this.getDateRange(filters);

        const matchQuery = {
            status: 'CONFIRMED',
            billDate: { $gte: fromDate, $lte: toDate },
            isDeleted: false
        };

        let query = { ...matchQuery };
        await this.applyRoleFilter(query, user);

        if (user.role === 'BOAT_OWNER') {
            const Boat = require('../models/boat.model');
            const boats = await Boat.find({ ownerId: user._id, isDeleted: false }).select('_id');
            query.boatId = { $in: boats.map(b => b._id) };
        }

        const [summaryAgg, weeklyAgg, locationAgg, fishAgg] = await Promise.all([
            Bill.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$grandTotal' },
                        totalBills: { $sum: 1 },
                        totalWeight: { $sum: { $sum: '$fishEntries.weightKg' } }
                    }
                }
            ]),
            Bill.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: { year: { $year: '$billDate' }, month: { $month: '$billDate' }, day: { $dayOfMonth: '$billDate' } },
                        revenue: { $sum: '$grandTotal' }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
                { $limit: 7 }
            ]),
            Bill.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: '$locationId',
                        revenue: { $sum: '$grandTotal' }
                    }
                }
            ]),
            Bill.aggregate([
                { $match: query },
                { $unwind: '$fishEntries' },
                {
                    $group: {
                        _id: '$fishEntries.fishId',
                        fishName: { $first: '$fishEntries.fishName' },
                        revenue: { $sum: '$fishEntries.totalAmount' },
                        weight: { $sum: '$fishEntries.weightKg' }
                    }
                },
                { $sort: { revenue: -1 } },
                { $limit: 10 }
            ])
        ]);

        const totalBills = summaryAgg[0]?.totalBills || 0;
        const activeBoats = totalBills > 0
            ? await Bill.distinct('boatId', query).then(ids => ids.length).catch(() => 0)
            : 0;

        const summary = summaryAgg[0] || { totalRevenue: 0, totalBills: 0, totalWeight: 0 };

        const revenueByLocation = {};
        for (const loc of locationAgg) {
            const locDoc = await Location.findById(loc._id).select('name').lean();
            const key = locDoc ? locDoc.name : 'Unknown';
            revenueByLocation[key] = loc.revenue;
        }

        const revenueByFish = {};
        for (const f of fishAgg) {
            revenueByFish[f.fishName || 'Unknown'] = f.revenue;
        }

        return {
            totalRevenue: summary.totalRevenue || 0,
            totalBills: summary.totalBills || 0,
            activeBoats: activeBoats || 0,
            totalWeight: summary.totalWeight || 0,
            weeklyRevenue: weeklyAgg.map(d => ({
                date: new Date(d._id.year, d._id.month - 1, d._id.day),
                revenue: d.revenue
            })),
            revenueByLocation,
            revenueByFish
        };
    }

    /**
     * Get quick dashboard stats
     * @param {Object} user - Current user
     * @returns {Promise<Object>} Dashboard stats
     */
    async getDashboardStats(user) {
        const query = {
            status: 'CONFIRMED',
            isDeleted: false
        };
        await this.applyRoleFilter(query, user);

        // Add additional filters for boat owner
        if (user.role === 'BOAT_OWNER') {
            const Boat = require('../models/boat.model');
            const boats = await Boat.find({
                ownerId: user._id,
                isDeleted: false
            }).select('_id');
            const boatIds = boats.map(b => b._id);
            query.boatId = { $in: boatIds };
        }

        const stats = await Bill.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$grandTotal' },
                    totalBills: { $sum: 1 },
                    totalWeight: { $sum: { $sum: '$fishEntries.weightKg' } },
                    totalCommission: { $sum: '$commissionAmount' }
                }
            }
        ]);

        // Get recent bills
        const recentBills = await Bill.find(query)
            .populate('boatId', 'boatNumber boatName')
            .populate('buyerId', 'name')
            .sort({ billDate: -1 })
            .limit(5)
            .lean();

        return {
            summary: stats[0] || {
                totalRevenue: 0,
                totalBills: 0,
                totalWeight: 0,
                totalCommission: 0
            },
            recentBills
        };
    }
}

module.exports = new ReportService();