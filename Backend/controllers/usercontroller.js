const userService = require('../services/userservice');
const { successResponse, paginatedResponse, errorResponse } = require('../utils/responseutils');
const { getPaginationParams, getSortParams, buildPaginationMeta } = require('../utils/paginationutils');
const logger = require('../config/logger');

/**
 * Create user
 */
const createUser = async (req, res, next) => {
    try {
        const userData = req.body;
        const user = await userService.createUser(userData);
        successResponse(res, 201, 'User created successfully', user);
    } catch (error) {
        logger.error('Create user error:', error);
        errorResponse(res, 400, error.message || 'Failed to create user');
    }
};

/**
 * Get users with pagination and filters
 */
const getUsers = async (req, res, next) => {
    try {
        const { page, limit, skip } = getPaginationParams(req.query);
        const sort = getSortParams(req.query, 'createdAt', 'desc');

        const { data, total } = await userService.getUsers(req.query, { page, limit, skip, sort });
        paginatedResponse(res, 200, 'Users retrieved successfully', data, buildPaginationMeta(total, page, limit));
    } catch (error) {
        logger.error('Get users error:', error);
        errorResponse(res, 500, error.message || 'Failed to get users');
    }
};

/**
 * Get user by ID
 */
const getUserById = async (req, res, next) => {
    try {
        const user = await userService.getUserById(req.params.id);
        successResponse(res, 200, 'User retrieved successfully', user);
    } catch (error) {
        logger.error('Get user by ID error:', error);
        errorResponse(res, 404, error.message || 'User not found');
    }
};

/**
 * Update user
 */
const updateUser = async (req, res, next) => {
    try {
        const user = await userService.updateUser(req.params.id, req.body);
        successResponse(res, 200, 'User updated successfully', user);
    } catch (error) {
        logger.error('Update user error:', error);
        errorResponse(res, 400, error.message || 'Failed to update user');
    }
};

/**
 * Delete user (soft delete)
 */
const deleteUser = async (req, res, next) => {
    try {
        await userService.deleteUser(req.params.id);
        successResponse(res, 200, 'User deleted successfully');
    } catch (error) {
        logger.error('Delete user error:', error);
        errorResponse(res, 400, error.message || 'Failed to delete user');
    }
};

/**
 * Get users by agent
 */
const getUsersByAgent = async (req, res, next) => {
    try {
        const users = await userService.getUsersByAgent(req.params.agentId);
        successResponse(res, 200, 'Users retrieved successfully', users);
    } catch (error) {
        logger.error('Get users by agent error:', error);
        errorResponse(res, 500, error.message || 'Failed to get users');
    }
};

/**
 * Toggle user active status
 */
const toggleUserStatus = async (req, res, next) => {
    try {
        const user = await userService.toggleUserStatus(req.params.id);
        successResponse(res, 200, 'User status updated successfully', user);
    } catch (error) {
        logger.error('Toggle user status error:', error);
        errorResponse(res, 400, error.message || 'Failed to update user status');
    }
};

module.exports = {
    createUser,
    getUsers,
    getUserById,
    updateUser,
    deleteUser,
    getUsersByAgent,
    toggleUserStatus
};