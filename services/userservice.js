const User = require('../models/usermodel');
const Location = require('../models/locationmodel');
const SubLocation = require('../models/subLocationmodel');
const { hashPassword, validatePasswordStrength } = require('../utils/bcryptutils');
const { getPaginationParams, buildPaginationMeta } = require('../utils/paginationutils');
const logger = require('../config/logger');

class UserService {
    /**
     * Create a new user
     * @param {Object} userData - User data
     * @returns {Promise<Object>} Created user
     */
    /**
 * Create a new user
 * @param {Object} userData - User data
 * @returns {Promise<Object>} Created user
 */
    async createUser(userData) {
        // Check if email already exists - with case-insensitive search
        const existingUser = await User.findOne({
            email: { $regex: new RegExp(`^${userData.email.toLowerCase()}$`, 'i') },
            isDeleted: false
        });

        if (existingUser) {
            throw new Error('Email already registered');
        }

        // Validate password strength
        if (userData.password) {
            const passwordValidation = validatePasswordStrength(userData.password);
            if (!passwordValidation.valid) {
                throw new Error(passwordValidation.errors.join('. '));
            }
        }

        // Validate agent ID for STAFF and FISH_BUYER
        if (userData.role === 'STAFF') {
            if (!userData.agentId) {
                throw new Error('STAFF must be assigned to a commission agent');
            }
            // Validate agent exists and is a COMMISSION_AGENT
            const agent = await User.findOne({
                _id: userData.agentId,
                role: 'COMMISSION_AGENT',
                isActive: true,
                isDeleted: false
            });
            if (!agent) {
                throw new Error('Invalid or inactive commission agent');
            }
        }

        // Create user with try-catch for duplicate key error
        try {
            const user = new User({
                ...userData,
                email: userData.email.toLowerCase().trim(),
                name: userData.name.trim()
            });

            await user.save();
            logger.info(`User created: ${user.email} (${user.role})`);
            return user.toJSON();
        } catch (error) {
            // Catch MongoDB duplicate key error
            if (error.code === 11000) {
                logger.warn(`Duplicate email attempt: ${userData.email}`);
                throw new Error('Email already registered');
            }
            throw error;
        }
    }
    /**
     * Get users with pagination and filters
     * @param {Object} filters - Filter parameters
     * @param {Object} pagination - Pagination parameters
     * @returns {Promise<Object>} Users with pagination
     */
    async getUsers(filters, pagination) {
        const { page, limit, skip, sort } = pagination;

        const query = { isDeleted: false };

        if (filters.role) query.role = filters.role;
        if (filters.locationId) query.locationId = filters.locationId;
        if (filters.isActive !== undefined) query.isActive = filters.isActive;

        if (filters.search) {
            query.$or = [
                { name: { $regex: filters.search, $options: 'i' } },
                { email: { $regex: filters.search, $options: 'i' } },
                { phone: { $regex: filters.search, $options: 'i' } }
            ];
        }

        const [users, total] = await Promise.all([
            User.find(query)
                .select('-password -refreshTokens')
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .lean(),
            User.countDocuments(query)
        ]);

        const Boat = require('../models/boatmodel');
        const data = await Promise.all(users.map(async (user) => {
            if (user.role === 'BOAT_OWNER') {
                const totalBoats = await Boat.countDocuments({
                    ownerId: user._id,
                    isDeleted: false
                });
                return { ...user, totalBoats };
            }
            return user;
        }));

        return {
            data,
            total
        };
    }

    /**
     * Get user by ID
     * @param {string} userId - User ID
     * @returns {Promise<Object>} User
     */
    async getUserById(userId) {
        const user = await User.findById(userId)
            .select('-password -refreshTokens')
            .populate('agentId', 'name email')
            .lean();

        if (!user) {
            throw new Error('User not found');
        }

        if (user.role === 'BOAT_OWNER') {
            const Boat = require('../models/boatmodel');
            user.totalBoats = await Boat.countDocuments({
                ownerId: user._id,
                isDeleted: false
            });
        }

        return user;
    }

    /**
     * Update user
     * @param {string} userId - User ID
     * @param {Object} updateData - Update data
     * @returns {Promise<Object>} Updated user
     */
    /**
  * Update user
  * @param {string} userId - User ID
  * @param {Object} updateData - Update data
  * @returns {Promise<Object>} Updated user
  */
    async updateUser(userId, updateData) {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Check email uniqueness if updating
        if (updateData.email) {
            const existingUser = await User.findOne({
                email: { $regex: new RegExp(`^${updateData.email.toLowerCase()}$`, 'i') },
                _id: { $ne: userId },
                isDeleted: false
            });

            if (existingUser) {
                throw new Error('Email already registered');
            }
        }

        // Validate agent if updating
        if (updateData.agentId) {
            const agent = await User.findOne({
                _id: updateData.agentId,
                role: 'COMMISSION_AGENT',
                isActive: true,
                isDeleted: false
            });

            if (!agent) {
                throw new Error('Invalid agent. Agent must be a COMMISSION_AGENT');
            }
        }

        // Handle password update
        if (updateData.password) {
            const passwordValidation = validatePasswordStrength(updateData.password);
            if (!passwordValidation.valid) {
                throw new Error(passwordValidation.errors.join('. '));
            }
            user.password = updateData.password;
            // Clear refresh tokens on password change
            await user.clearRefreshTokens();
        }

        // Update other fields
        const updateFields = { ...updateData };
        delete updateFields.password;

        Object.keys(updateFields).forEach(key => {
            if (key === 'email') {
                user[key] = updateFields[key].toLowerCase().trim();
            } else if (key === 'name') {
                user[key] = updateFields[key].trim();
            } else {
                user[key] = updateFields[key];
            }
        });

        try {
            await user.save();
            logger.info(`User updated: ${user.email} by system`);
            return user.toJSON();
        } catch (error) {
            // Catch MongoDB duplicate key error
            if (error.code === 11000) {
                logger.warn(`Duplicate email attempt during update: ${updateData.email}`);
                throw new Error('Email already registered');
            }
            throw error;
        }
    }

    /*  Delete user (soft delete)
  * @param {string} userId - User ID
  * @returns {Promise<void>}
    */
    async deleteUser(userId) {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Prevent deleting SUPER_ADMIN
        if (user.role === 'SUPER_ADMIN') {
            throw new Error('Cannot delete SUPER_ADMIN user');
        }

        // Check if user has any active boats (if BOAT_OWNER)
        if (user.role === 'BOAT_OWNER') {
            const Boat = require('../models/boatmodel');
            const boatCount = await Boat.countDocuments({
                ownerId: userId,
                isDeleted: false
            });

            if (boatCount > 0) {
                throw new Error('Cannot delete boat owner with active boats');
            }
        }

        // ❌ REMOVE THIS ENTIRE BILL CHECK BLOCK
        // if (['COMMISSION_AGENT', 'STAFF'].includes(user.role)) {
        //     const Bill = require('../models/billmodel');
        //     const billCount = await Bill.countDocuments({
        //         $or: [
        //             { agentId: userId },
        //             { staffId: userId }
        //         ],
        //         isDeleted: false
        //     });

        //     if (billCount > 0) {
        //         throw new Error('Cannot delete user with existing bills');
        //     }
        // }

        // Soft delete the user - bills will remain in the database
        user.isDeleted = true;
        user.isActive = false;
        await user.clearRefreshTokens();
        await user.save();

        logger.info(`User deleted: ${user.email}`);
    }
    /**
     * Get users by agent
     * @param {string} agentId - Agent ID
     * @returns {Promise<Array>} List of users
     */
    async getUsersByAgent(agentId) {
        const agent = await User.findById(agentId);
        if (!agent) {
            throw new Error('Agent not found');
        }

        const users = await User.find({
            agentId,
            isDeleted: false
        })
            .select('-password -refreshTokens')
            .sort({ name: 1 })
            .lean();

        return users;
    }

    /**
     * Toggle user active status
     * @param {string} userId - User ID
     * @returns {Promise<Object>} Updated user
     */
    async toggleUserStatus(userId) {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Prevent deactivating SUPER_ADMIN
        if (user.role === 'SUPER_ADMIN') {
            throw new Error('Cannot deactivate SUPER_ADMIN user');
        }

        user.isActive = !user.isActive;
        await user.save();

        logger.info(`User ${user.isActive ? 'activated' : 'deactivated'}: ${user.email}`);
        return user.toJSON();
    }

    /**
     * Get user count by role
     * @param {string} role - User role
     * @param {string} agentId - Agent ID (optional)
     * @returns {Promise<number>} Count of users
     */
    async getUserCountByRole(role, agentId = null) {
        const query = {
            role,
            isDeleted: false,
            isActive: true
        };

        if (agentId) {
            query.agentId = agentId;
        }

        return User.countDocuments(query);
    }

    /**
     * Get all agents
     * @param {Object} filters - Filter parameters
     * @returns {Promise<Array>} List of agents
     */
    async getAgents(filters = {}) {
        const query = {
            role: 'COMMISSION_AGENT',
            isDeleted: false,
            isActive: true
        };

        if (filters.locationId) {
            query.locationId = filters.locationId;
        }

        return User.find(query)
            .select('name email phone locationId subLocationId')
            .sort({ name: 1 })
            .lean();
    }

    /**
     * Get users by location
     * @param {string} locationId - Location ID
     * @param {string} role - User role (optional)
     * @returns {Promise<Array>} List of users
     */
    async getUsersByLocation(locationId, role = null) {
        const query = {
            locationId,
            isDeleted: false,
            isActive: true
        };

        if (role) {
            query.role = role;
        }

        return User.find(query)
            .select('-password -refreshTokens')
            .sort({ name: 1 })
            .lean();
    }

    /**
     * Check if email is available
     * @param {string} email - Email to check
     * @param {string} excludeId - User ID to exclude
     * @returns {Promise<boolean>} True if available
     */
    async isEmailAvailable(email, excludeId = null) {
        const query = {
            email: email.toLowerCase(),
            isDeleted: false
        };

        if (excludeId) {
            query._id = { $ne: excludeId };
        }

        const count = await User.countDocuments(query);
        return count === 0;
    }

    /**
     * Get user by email
     * @param {string} email - User email
     * @returns {Promise<Object>} User
     */
    async getUserByEmail(email) {
        const user = await User.findOne({
            email: email.toLowerCase(),
            isDeleted: false
        })
            .select('-password -refreshTokens')
            .lean();

        if (!user) {
            throw new Error('User not found');
        }

        return user;
    }

    /**
     * Update last login timestamp
     * @param {string} userId - User ID
     * @returns {Promise<void>}
     */
    async updateLastLogin(userId) {
        await User.findByIdAndUpdate(userId, {
            lastLogin: new Date()
        });
    }

    async getCommissionAgents() {
        return await User.find({
            role: 'COMMISSION_AGENT',
            isActive: true,
            isDeleted: false
        })
            .select('_id name email phone')  // Only return needed fields
            .sort({ name: 1 })  // Sort alphabetically
            .lean();
    }
}

module.exports = new UserService();