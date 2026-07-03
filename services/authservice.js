const User = require('../models/usermodel');
const jwtUtils = require('../utils/jwtutils');
const bcryptUtils = require('../utils/bcryptutils');
const { generateBillNumber } = require('../utils/idGeneratorutils');
const logger = require('../config/logger');
const env = require('../config/env');

class AuthService {
    /**
     * Login user
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} User data with tokens
     */
    async login(email, password) {
        const user = await User.findByEmail(email);

        if (!user) {
            throw new Error('Invalid credentials');
        }

        if (!user.isActive || user.isDeleted) {
            throw new Error('Account is disabled');
        }

        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            throw new Error('Invalid credentials');
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();

        // Generate tokens
        const accessToken = jwtUtils.generateAccessToken(user._id, user.role);
        const refreshToken = jwtUtils.generateRefreshToken(user._id, user.role);

        // Store refresh token
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        await user.addRefreshToken(refreshToken, expiresAt);

        // Return user without sensitive data
        const userData = user.toJSON();

        logger.info(`User logged in: ${user.email} (${user.role})`);

        return {
            user: userData,
            accessToken,
            refreshToken
        };
    }

    /**
     * Refresh access token
     * @param {string} refreshToken - Refresh token
     * @returns {Promise<Object>} New access token
     */
    async refreshToken(refreshToken) {
        try {
            const decoded = jwtUtils.verifyRefreshToken(refreshToken);
            const user = await User.findById(decoded.userId);

            if (!user) {
                throw new Error('User not found');
            }

            if (!user.isActive || user.isDeleted) {
                throw new Error('Account is disabled');
            }

            // Check if refresh token exists
            const tokenExists = user.refreshTokens.some(t => t.token === refreshToken);
            if (!tokenExists) {
                throw new Error('Invalid refresh token');
            }

            // Generate new access token
            const accessToken = jwtUtils.generateAccessToken(user._id, user.role);

            return {
                accessToken,
                user: user.toJSON()
            };
        } catch (error) {
            logger.error('Refresh token error:', error);
            throw new Error('Invalid or expired refresh token');
        }
    }

    /**
     * Logout user
     * @param {string} userId - User ID
     * @param {string} refreshToken - Refresh token to invalidate
     * @returns {Promise<void>}
     */
    async logout(userId, refreshToken) {
        const user = await User.findById(userId);
        if (user) {
            await user.removeRefreshToken(refreshToken);
            logger.info(`User logged out: ${user.email}`);
        }
    }

    /**
     * Change password
     * @param {string} userId - User ID
     * @param {string} currentPassword - Current password
     * @param {string} newPassword - New password
     * @returns {Promise<void>}
     */
    async changePassword(userId, currentPassword, newPassword) {
        const user = await User.findById(userId);
        if (!user) {
            throw new Error('User not found');
        }

        const isPasswordValid = await user.comparePassword(currentPassword);
        if (!isPasswordValid) {
            throw new Error('Current password is incorrect');
        }

        // Validate new password strength
        const validation = bcryptUtils.validatePasswordStrength(newPassword);
        if (!validation.valid) {
            throw new Error(validation.errors.join('. '));
        }

        user.password = newPassword;
        // Clear all refresh tokens on password change
        await user.clearRefreshTokens();
        await user.save();

        logger.info(`Password changed for user: ${user.email}`);
    }

    /**
     * Validate user and return user data
     * @param {string} userId - User ID
     * @returns {Promise<Object>} User data
     */
    async getUserById(userId) {
        const user = await User.findById(userId)
            .select('-password -refreshTokens')
            .lean();

        if (!user) {
            throw new Error('User not found');
        }

        return user;
    }

    /**
     * Check if user has required role
     * @param {Object} user - User object
     * @param {Array} allowedRoles - Allowed roles
     * @returns {boolean} True if user has required role
     */
    hasRole(user, allowedRoles) {
        return allowedRoles.includes(user.role);
    }

    /**
     * Generate bill number
     * @param {Date} date - Bill date
     * @returns {Promise<string>} Generated bill number
     */
    async generateBillNumber(date = new Date()) {
        // Get the last bill number
        const Bill = require('../models/billmodel');
        const lastBill = await Bill.findOne({})
            .sort({ createdAt: -1 })
            .limit(1);

        let sequence = 1;
        if (lastBill) {
            const lastNumber = lastBill.billNumber;
            const lastSeq = parseInt(lastNumber.split('-')[2]);
            if (!isNaN(lastSeq)) {
                sequence = lastSeq + 1;
            }
        }

        return generateBillNumber(date, sequence);
    }
}

module.exports = new AuthService();