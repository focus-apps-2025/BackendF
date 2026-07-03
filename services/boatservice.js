const Boat = require('../models/boatmodel');
const User = require('../models/usermodel');
const Location = require('../models/locationmodel');
const SubLocation = require('../models/subLocationmodel');
const { getPaginationParams, buildPaginationMeta } = require('../utils/paginationutils');
const logger = require('../config/logger');

class BoatService {
    /**
     * Create a new boat
     * @param {Object} boatData - Boat data
     * @param {Object} user - Current user
     * @returns {Promise<Object>} Created boat
     */
    async createBoat(boatData, user) {
        // Validate owner exists and is a BOAT_OWNER
        const owner = await User.findOne({
            _id: boatData.ownerId,
            role: 'BOAT_OWNER',
            isActive: true,
            isDeleted: false
        });

        if (!owner) {
            throw new Error('Invalid boat owner. Owner must be a BOAT_OWNER');
        }

        // Validate agent if provided
        if (boatData.agentId) {
            const agent = await User.findOne({
                _id: boatData.agentId,
                role: { $in: ['COMMISSION_AGENT', 'SUPER_ADMIN'] },
                isActive: true,
                isDeleted: false
            });

            if (!agent) {
                throw new Error('Invalid agent. Agent must be a COMMISSION_AGENT');
            }
        }

        // Validate location if provided
        if (boatData.locationId) {
            const location = await Location.findOne({
                _id: boatData.locationId,
                isActive: true,
                isDeleted: false
            });

            if (!location) {
                throw new Error('Invalid location');
            }
        }

        // Validate sub-location if provided
        if (boatData.subLocationId) {
            const subLocation = await SubLocation.findOne({
                _id: boatData.subLocationId,
                isActive: true,
                isDeleted: false
            });

            if (!subLocation) {
                throw new Error('Invalid sub-location');
            }
        }

        // Check if boat number already exists
        const existingBoat = await Boat.findOne({
            boatNumber: boatData.boatNumber.toUpperCase(),
            isDeleted: false
        });

        if (existingBoat) {
            throw new Error('Boat number already exists');
        }

        const boat = new Boat({
            ...boatData,
            boatNumber: boatData.boatNumber.toUpperCase(),
            boatName: boatData.boatName.trim()
        });

        await boat.save();

        logger.info(`Boat created: ${boat.boatNumber} by user ${user._id}`);
        return boat;
    }

    /**
     * Get boats with pagination and filters
     * @param {Object} filters - Filter parameters
     * @param {Object} pagination - Pagination parameters
     * @param {Object} user - Current user
     * @returns {Promise<Object>} Boats with pagination
     */
    async getBoats(filters, pagination, user) {
        const { page, limit, skip } = pagination;

        // Build query based on user role
        const query = { isDeleted: false };

        // Apply role-based filtering
        this.applyRoleFilter(query, user);

        // Apply additional filters
        if (filters.locationId) query.locationId = filters.locationId;
        if (filters.subLocationId) query.subLocationId = filters.subLocationId;
        if (filters.ownerId) query.ownerId = filters.ownerId;
        if (filters.agentId) query.agentId = filters.agentId;
        if (filters.isActive !== undefined) query.isActive = filters.isActive;

        if (filters.search) {
            query.$or = [
                { boatNumber: { $regex: filters.search, $options: 'i' } },
                { boatName: { $regex: filters.search, $options: 'i' } },
                { registrationNumber: { $regex: filters.search, $options: 'i' } }
            ];
        }

        const [boats, total] = await Promise.all([
            Boat.find(query)
                .populate('ownerId', 'name email phone')
                .populate('agentId', 'name email')
                .populate('locationId', 'name')
                .populate('subLocationId', 'name')
                .sort({ [filters.sortBy || 'createdAt']: filters.sortOrder === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Boat.countDocuments(query)
        ]);

        return {
            data: boats,
            total
        };
    }

    /**
     * Get boat by ID
     * @param {string} boatId - Boat ID
     * @param {Object} user - Current user
     * @returns {Promise<Object>} Boat with populated fields
     */
    async getBoatById(boatId, user) {
        const boat = await Boat.findById(boatId)
            .populate('ownerId', 'name email phone')
            .populate('agentId', 'name email')
            .populate('locationId', 'name')
            .populate('subLocationId', 'name')
            .lean();

        if (!boat) {
            throw new Error('Boat not found');
        }

        // Check access
        this.checkBoatAccess(boat, user);

        return boat;
    }

    /**
     * Update boat
     * @param {string} boatId - Boat ID
     * @param {Object} updateData - Update data
     * @param {Object} user - Current user
     * @returns {Promise<Object>} Updated boat
     */
    async updateBoat(boatId, updateData, user) {
        const boat = await Boat.findById(boatId);
        if (!boat) {
            throw new Error('Boat not found');
        }

        // Check access
        this.checkBoatAccess(boat, user);

        // Prevent duplicate boat number
        if (updateData.boatNumber) {
            const existingBoat = await Boat.findOne({
                boatNumber: updateData.boatNumber.toUpperCase(),
                _id: { $ne: boatId },
                isDeleted: false
            });

            if (existingBoat) {
                throw new Error('Boat number already exists');
            }
        }

        // Validate owner if being updated
        if (updateData.ownerId) {
            const owner = await User.findOne({
                _id: updateData.ownerId,
                role: 'BOAT_OWNER',
                isActive: true,
                isDeleted: false
            });

            if (!owner) {
                throw new Error('Invalid boat owner. Owner must be a BOAT_OWNER');
            }
        }

        // Validate location if being updated
        if (updateData.locationId) {
            const location = await Location.findOne({
                _id: updateData.locationId,
                isActive: true,
                isDeleted: false
            });

            if (!location) {
                throw new Error('Invalid location');
            }
        }

        // Validate sub-location if being updated
        if (updateData.subLocationId) {
            const locationId = updateData.locationId || boat.locationId;
            const subLocation = await SubLocation.findOne({
                _id: updateData.subLocationId,
                locationId: locationId,
                isActive: true,
                isDeleted: false
            });

            if (!subLocation) {
                throw new Error('Invalid sub-location for the given location');
            }
        }

        // Update fields
        Object.keys(updateData).forEach(key => {
            if (key === 'boatNumber') {
                boat[key] = updateData[key].toUpperCase();
            } else if (key === 'boatName') {
                boat[key] = updateData[key].trim();
            } else {
                boat[key] = updateData[key];
            }
        });

        await boat.save();

        logger.info(`Boat updated: ${boat.boatNumber} by user ${user._id}`);
        return boat;
    }

    /**
     * Delete boat (soft delete)
     * @param {string} boatId - Boat ID
     * @param {Object} user - Current user
     * @returns {Promise<void>}
     */
    async deleteBoat(boatId, user) {
        const boat = await Boat.findById(boatId);
        if (!boat) {
            throw new Error('Boat not found');
        }

        // Check access
        this.checkBoatAccess(boat, user);

        // Check if boat has any bills
        const Bill = require('../models/bill.model');
        const billCount = await Bill.countDocuments({
            boatId: boatId,
            isDeleted: false,
            status: { $in: ['CONFIRMED', 'PAID'] }
        });

        if (billCount > 0) {
            throw new Error('Cannot delete boat with existing bills');
        }

        boat.isDeleted = true;
        await boat.save();

        logger.info(`Boat deleted: ${boat.boatNumber} by user ${user._id}`);
    }

    /**
     * Get boats by owner
     * @param {string} ownerId - Owner user ID
     * @param {Object} user - Current user
     * @returns {Promise<Array>} List of boats
     */
    async getBoatsByOwner(ownerId, user) {
        // Verify owner exists
        const owner = await User.findById(ownerId);
        if (!owner) {
            throw new Error('Owner not found');
        }

        // Check access
        if (user.role !== 'SUPER_ADMIN' &&
            user._id.toString() !== ownerId.toString() &&
            user.agentId?.toString() !== ownerId.toString()) {
            throw new Error('Access denied');
        }

        const boats = await Boat.find({
            ownerId,
            isDeleted: false
        })
            .populate('locationId', 'name')
            .populate('subLocationId', 'name')
            .sort({ boatNumber: 1 })
            .lean();

        return boats;
    }

    /**
     * Get boats by agent
     * @param {string} agentId - Agent user ID
     * @param {Object} user - Current user
     * @returns {Promise<Array>} List of boats
     */
    async getBoatsByAgent(agentId, user) {
        // Verify agent exists
        const agent = await User.findById(agentId);
        if (!agent) {
            throw new Error('Agent not found');
        }

        // Check access
        if (user.role !== 'SUPER_ADMIN' &&
            user._id.toString() !== agentId.toString()) {
            throw new Error('Access denied');
        }

        const boats = await Boat.find({
            agentId,
            isDeleted: false
        })
            .populate('ownerId', 'name email phone')
            .populate('locationId', 'name')
            .populate('subLocationId', 'name')
            .sort({ boatNumber: 1 })
            .lean();

        return boats;
    }

    /**
     * Check if user has access to boat
     * @param {Object} boat - Boat document
     * @param {Object} user - Current user
     * @throws {Error} If access denied
     */
    checkBoatAccess(boat, user) {
        if (user.role === 'SUPER_ADMIN') return true;

        const hasAccess = (
            boat.agentId?.toString() === user._id.toString() ||
            boat.ownerId?.toString() === user._id.toString() ||
            (user.role === 'STAFF' && user.agentId?.toString() === boat.agentId?.toString())
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
                // No filter - agent can see all boats to book
                break;
            case 'BOAT_OWNER':
                query.ownerId = user._id;
                break;
            case 'STAFF':
                // No filter - staff can see all boats
                break;
            case 'FISH_BUYER':
                // No filter - fish buyer can see available boats to book
                break;
            default:
                query._id = null; // No access
        }
    }

    /**
     * Get boat count by agent
     * @param {string} agentId - Agent ID
     * @returns {Promise<number>} Count of boats
     */
    async getBoatCountByAgent(agentId) {
        return Boat.countDocuments({
            agentId,
            isDeleted: false,
            isActive: true
        });
    }

    /**
     * Check if boat number is available
     * @param {string} boatNumber - Boat number
     * @param {string} excludeId - Boat ID to exclude from check
     * @returns {Promise<boolean>} True if available
     */
    async isBoatNumberAvailable(boatNumber, excludeId = null) {
        const query = {
            boatNumber: boatNumber.toUpperCase(),
            isDeleted: false
        };

        if (excludeId) {
            query._id = { $ne: excludeId };
        }

        const count = await Boat.countDocuments(query);
        return count === 0;
    }
}

module.exports = new BoatService();