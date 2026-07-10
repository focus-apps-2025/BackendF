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
        // ✅ Validate user
        if (!user || !user._id) {
            throw new Error('Authentication required');
        }

        // Handle based on user role
        let agentId = null;
        let isGlobal = false;

        if (user.role === 'FISH_BUYER') {
            // FISH_BUYER: agentId = null, isGlobal = true
            agentId = null;
            isGlobal = true;
        } else if (user.role === 'COMMISSION_AGENT' || user.role === 'SUPER_ADMIN') {
            // Agent/Admin: use provided agentId or their own ID
            agentId = fishData.agentId || user._id.toString();

            // Validate agent exists
            const agent = await User.findOne({
                _id: agentId,
                role: { $in: ['COMMISSION_AGENT', 'SUPER_ADMIN'] },
                isActive: true,
                isDeleted: false
            });

            if (!agent) {
                throw new Error('Invalid agent. Agent must be a COMMISSION_AGENT or SUPER_ADMIN');
            }
            isGlobal = false;
        } else {
            throw new Error('Only FISH_BUYER, COMMISSION_AGENT, or SUPER_ADMIN can create fish');
        }

        // Check if fish already exists
        const query = {
            name: fishData.name.toUpperCase(),
            isDeleted: false
        };

        // For FISH_BUYER, check global uniqueness
        // For AGENT/ADMIN, check uniqueness within agent
        if (user.role !== 'FISH_BUYER') {
            query.agentId = agentId;
        }

        const existingFish = await Fish.findOne(query);

        if (existingFish) {
            throw new Error(`Fish "${fishData.name}" already exists`);
        }

        // Create fish with proper fields
        const fish = new Fish({
            name: fishData.name.toUpperCase(),
            localName: fishData.localName?.trim(),
            pricePerKg: fishData.pricePerKg || 0,
            category: fishData.category?.toUpperCase() || 'GENERAL',
            agentId: agentId,
            createdBy: user._id,
            isGlobal: isGlobal,
            isActive: true,
            isDeleted: false
        });

        await fish.save();

        logger.info(`Fish created: ${fish.name} by user ${user._id} (role: ${user.role})`);
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
                .populate('createdBy', 'name email role')
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
            .populate('createdBy', 'name email role')
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

        // Prevent duplicate name
        if (updateData.name) {
            const query = {
                name: updateData.name.toUpperCase(),
                _id: { $ne: fishId },
                isDeleted: false
            };

            // For non-FISH_BUYER, check within same agent
            if (user.role !== 'FISH_BUYER') {
                query.agentId = fish.agentId;
            }

            const existingFish = await Fish.findOne(query);

            if (existingFish) {
                throw new Error(`Fish "${updateData.name}" already exists`);
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
            } else if (key !== 'agentId' && key !== 'createdBy') {
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
     * @returns {Promise<Object>} Deleted fish
     */
    async deleteFish(fishId, user) {
        // ✅ Validate user
        if (!user || !user._id) {
            throw new Error('Authentication required');
        }

        // Find the fish
        const fish = await Fish.findById(fishId);
        if (!fish || fish.isDeleted) {
            throw new Error('Fish not found');
        }

        // ✅ SAFELY convert IDs to strings with null checks
        const userId = user._id ? user._id.toString() : null;
        const fishAgentId = fish.agentId ? fish.agentId.toString() : null;
        const fishCreatedBy = fish.createdBy ? fish.createdBy.toString() : null;

        // Check permissions based on role
        if (user.role === 'FISH_BUYER') {
            // FISH_BUYER can only delete their own fish
            if (!fishCreatedBy || fishCreatedBy !== userId) {
                throw new Error('You can only delete fish you created');
            }
        }
        else if (user.role === 'COMMISSION_AGENT') {
            // Agent can delete fish assigned to them or created by them
            const isAssigned = fishAgentId && fishAgentId === userId;
            const isCreator = fishCreatedBy && fishCreatedBy === userId;

            if (!isAssigned && !isCreator) {
                throw new Error('You can only delete fish assigned to you or created by you');
            }
        }
        // SUPER_ADMIN can delete anything - no check needed

        // Soft delete
        fish.isDeleted = true;
        fish.isActive = false;
        await fish.save();

        logger.info(`Fish deleted: ${fish.name} by user ${userId} (role: ${user.role})`);
        return fish;
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
            .populate('createdBy', 'name email role')
            .sort({ name: 1 })
            .lean();

        return fish;
    }

    /**
     * Get fish by creator (for "My Fish" page)
     * @param {string} userId - User ID
     * @returns {Promise<Array>} List of fish created by user
     */
    async getFishByCreator(userId) {
        return await Fish.find({
            createdBy: userId,
            isDeleted: false
        })
            .populate('createdBy', 'name email role')
            .populate('agentId', 'name email')
            .sort({ name: 1 })
            .lean();
    }

    /**
     * Check if user has access to fish
     * @param {Object} fish - Fish document
     * @param {Object} user - Current user
     * @throws {Error} If access denied
     */
    checkFishAccess(fish, user) {
        if (user.role === 'SUPER_ADMIN') return true;

        // FISH_BUYER can access their own fish or global fish
        if (user.role === 'FISH_BUYER') {
            if (fish.isGlobal || fish.createdBy?.toString() === user._id.toString()) {
                return true;
            }
            throw new Error('Access denied');
        }

        // COMMISSION_AGENT and STAFF access
        const hasAccess = (
            fish.agentId?.toString() === user._id.toString() ||
            (user.role === 'STAFF' && user.agentId?.toString() === fish.agentId?.toString()) ||
            fish.createdBy?.toString() === user._id.toString()
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
        // ✅ Validate user
        if (!user || !user._id) {
            return;
        }

        switch (user.role) {
            case 'SUPER_ADMIN':
                // No filter - see all fish
                break;
            case 'COMMISSION_AGENT':
                // Agent sees fish assigned to them or created by them
                query.$or = [
                    { agentId: user._id },
                    { createdBy: user._id }
                ];
                break;
            case 'FISH_BUYER':
                // FISH_BUYER sees global fish + their own fish
                query.$or = [
                    { isGlobal: true },
                    { createdBy: user._id }
                ];
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
     * @returns {Promise<Object>} Created fish and errors
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