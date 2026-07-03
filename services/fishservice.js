const Fish = require('../models/fishmodel');
const User = require('../models/usermodel');
const { getPaginationParams, buildPaginationMeta } = require('../utils/paginationutils');
const logger = require('../config/logger');

class FishService {
    /**
     * Create a new fish entry
     * @param {Object} fishData - Fish data
     * @param {Object} user - Current user
     * @returns {Promise<Object>} Created fish
     */
    async createFish(fishData, user) {
        // Use authenticated user's ID as the agentId (ignore any client-sent agentId)
        const agentId = user._id.toString();

        // Validate agent exists
        const agent = await User.findOne({
            _id: agentId,
            role: { $in: ['COMMISSION_AGENT', 'SUPER_ADMIN'] },
            isActive: true,
            isDeleted: false
        });

        if (!agent) {
            throw new Error('Invalid agent. Agent must be a COMMISSION_AGENT');
        }

        // Check if fish already exists for this agent
        const existingFish = await Fish.findOne({
            name: fishData.name.toUpperCase(),
            agentId: agentId,
            isDeleted: false
        });

        if (existingFish) {
            throw new Error(`Fish "${fishData.name}" already exists for this agent`);
        }

        const fish = new Fish({
            name: fishData.name.toUpperCase(),
            agentId: agentId,
            localName: fishData.localName?.trim() || undefined,
            category: fishData.category?.toUpperCase() || undefined,
            pricePerKg: fishData.pricePerKg ?? 0,
            isActive: fishData.isActive !== undefined ? fishData.isActive : true,
        });

        await fish.save();

        logger.info(`Fish created: ${fish.name} by user ${user._id}`);
        return fish;
    }

    /**
     * Get fish with pagination and filters
     * @param {Object} filters - Filter parameters
     * @param {Object} pagination - Pagination parameters
     * @param {Object} user - Current user
     * @returns {Promise<Object>} Fish with pagination
     */
    async getFish(filters, pagination, user) {
        const { page, limit, skip } = pagination;

        // Build query based on user role
        const query = { isDeleted: false };

        // Apply role-based filtering
        this.applyRoleFilter(query, user);

        // Apply additional filters
        if (filters.agentId) query.agentId = filters.agentId;
        if (filters.category) query.category = filters.category.toUpperCase();
        if (filters.isActive !== undefined) query.isActive = filters.isActive;

        if (filters.search) {
            query.$or = [
                { name: { $regex: filters.search, $options: 'i' } },
                { localName: { $regex: filters.search, $options: 'i' } },
                { category: { $regex: filters.search, $options: 'i' } }
            ];
        }

        const [fish, total] = await Promise.all([
            Fish.find(query)
                .populate('agentId', 'name email')
                .sort({ [filters.sortBy || 'name']: filters.sortOrder === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Fish.countDocuments(query)
        ]);

        return {
            data: fish,
            total
        };
    }

    /**
     * Get fish by ID
     * @param {string} fishId - Fish ID
     * @param {Object} user - Current user
     * @returns {Promise<Object>} Fish with populated fields
     */
    async getFishById(fishId, user) {
        const fish = await Fish.findById(fishId)
            .populate('agentId', 'name email')
            .lean();

        if (!fish) {
            throw new Error('Fish not found');
        }

        // Check access
        this.checkFishAccess(fish, user);

        return fish;
    }

    /**
     * Update fish
     * @param {string} fishId - Fish ID
     * @param {Object} updateData - Update data
     * @param {Object} user - Current user
     * @returns {Promise<Object>} Updated fish
     */
    async updateFish(fishId, updateData, user) {
        const fish = await Fish.findById(fishId);
        if (!fish) {
            throw new Error('Fish not found');
        }

        // Check access
        this.checkFishAccess(fish, user);

        // Prevent duplicate name for same agent
        if (updateData.name) {
            const existingFish = await Fish.findOne({
                name: updateData.name.toUpperCase(),
                agentId: fish.agentId,
                _id: { $ne: fishId },
                isDeleted: false
            });

            if (existingFish) {
                throw new Error(`Fish "${updateData.name}" already exists for this agent`);
            }
        }

        // Update fields
        Object.keys(updateData).forEach(key => {
            if (key === 'name') {
                fish[key] = updateData[key].toUpperCase();
            } else if (key === 'localName') {
                fish[key] = updateData[key]?.trim();
            } else if (key === 'category') {
                fish[key] = updateData[key]?.toUpperCase();
            } else {
                fish[key] = updateData[key];
            }
        });

        await fish.save();

        logger.info(`Fish updated: ${fish.name} by user ${user._id}`);
        return fish;
    }

    /**
     * Delete fish (soft delete)
     * @param {string} fishId - Fish ID
     * @param {Object} user - Current user
     * @returns {Promise<void>}
     */
    async deleteFish(fishId, user) {
        const fish = await Fish.findById(fishId);
        if (!fish) {
            throw new Error('Fish not found');
        }

        // Check access
        this.checkFishAccess(fish, user);

        // Check if fish is used in any bills
        const Bill = require('../models/bill.model');
        const billCount = await Bill.countDocuments({
            'fishEntries.fishId': fishId,
            isDeleted: false
        });

        if (billCount > 0) {
            throw new Error('Cannot delete fish that is used in bills');
        }

        fish.isDeleted = true;
        await fish.save();

        logger.info(`Fish deleted: ${fish.name} by user ${user._id}`);
    }

    /**
     * Get fish by agent
     * @param {string} agentId - Agent user ID
     * @param {Object} user - Current user
     * @returns {Promise<Array>} List of fish
     */
    async getFishByAgent(agentId, user) {
        // Verify agent exists
        const agent = await User.findById(agentId);
        if (!agent) {
            throw new Error('Agent not found');
        }

        // Check access
        if (user.role !== 'SUPER_ADMIN' &&
            user._id.toString() !== agentId.toString() &&
            user.agentId?.toString() !== agentId.toString()) {
            throw new Error('Access denied');
        }

        const fish = await Fish.find({
            agentId,
            isDeleted: false,
            isActive: true
        })
            .sort({ name: 1 })
            .lean();

        return fish;
    }

    /**
     * Check if user has access to fish
     * @param {Object} fish - Fish document
     * @param {Object} user - Current user
     * @throws {Error} If access denied
     */
    checkFishAccess(fish, user) {
        if (user.role === 'SUPER_ADMIN') return true;

        const hasAccess = (
            fish.agentId?.toString() === user._id.toString() ||
            (user.role === 'STAFF' && user.agentId?.toString() === fish.agentId?.toString())
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
                if (user.agentId) {
                    query.agentId = user.agentId;
                } else {
                    query._id = null; // No access
                }
                break;
            default:
                query._id = null; // No access
        }
    }

    /**
     * Get fish by IDs (batch)
     * @param {Array} fishIds - Array of fish IDs
     * @param {string} agentId - Agent ID for validation
     * @returns {Promise<Array>} List of fish
     */
    async getFishByIds(fishIds, agentId = null) {
        const query = {
            _id: { $in: fishIds },
            isDeleted: false,
            isActive: true
        };

        if (agentId) {
            query.agentId = agentId;
        }

        return Fish.find(query)
            .lean();
    }

    /**
     * Get fish count by agent
     * @param {string} agentId - Agent ID
     * @returns {Promise<number>} Count of fish
     */
    async getFishCountByAgent(agentId) {
        return Fish.countDocuments({
            agentId,
            isDeleted: false,
            isActive: true
        });
    }

    /**
     * Bulk create fish
     * @param {Array} fishDataArray - Array of fish data
     * @param {Object} user - Current user
     * @returns {Promise<Array>} Created fish
     */
    async bulkCreateFish(fishDataArray, user) {
        const createdFish = [];
        const errors = [];

        for (const fishData of fishDataArray) {
            try {
                const fish = await this.createFish(fishData, user);
                createdFish.push(fish);
            } catch (error) {
                errors.push({
                    data: fishData,
                    error: error.message
                });
            }
        }

        if (errors.length > 0) {
            logger.warn(`Bulk fish creation completed with ${errors.length} errors`);
        }

        return {
            created: createdFish,
            errors
        };
    }
}

module.exports = new FishService();