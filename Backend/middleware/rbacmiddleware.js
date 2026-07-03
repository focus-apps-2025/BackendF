const { errorResponse } = require('../utils/responseutils');
const logger = require('../config/logger');

/**
 * Role-based access control middleware
 * @param {...string} allowedRoles - List of roles that can access the route
 */
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        try {
            if (!req.user) {
                return errorResponse(res, 401, 'User not authenticated');
            }

            const userRole = req.user.role;

            if (!allowedRoles.includes(userRole)) {
                logger.warn(`Access denied for user ${req.user._id} with role ${userRole}. Required: ${allowedRoles.join(', ')}`);
                return errorResponse(res, 403, 'Insufficient permissions');
            }

            next();
        } catch (error) {
            logger.error('Authorization error:', error);
            return errorResponse(res, 500, 'Authorization failed');
        }
    };
};

/**
 * Check if user has permission to access a resource
 * @param {Object} req - Express request object
 * @param {string} resourceUserId - User ID of the resource owner
 * @param {string} resourceAgentId - Agent ID of the resource
 * @returns {boolean}
 */
const hasResourceAccess = (req, resourceUserId, resourceAgentId) => {
    const user = req.user;
    const role = user.role;

    // Super admin has access to everything
    if (role === 'SUPER_ADMIN') return true;

    // Users can access their own resources
    if (resourceUserId && user._id.toString() === resourceUserId.toString()) {
        return true;
    }

    // Agents can access resources under them
    if (role === 'COMMISSION_AGENT') {
        if (resourceAgentId && user._id.toString() === resourceAgentId.toString()) {
            return true;
        }
    }

    // Staff can access resources under their agent
    if (role === 'STAFF' && user.agentId) {
        if (resourceAgentId && user.agentId.toString() === resourceAgentId.toString()) {
            return true;
        }
    }

    return false;
};

/**
 * Middleware to check if user is the resource owner or has permission
 */
const checkResourceAccess = (userIdField = 'userId', agentIdField = 'agentId') => {
    return (req, res, next) => {
        try {
            const resourceUserId = req.params[userIdField] || req.body[userIdField];
            const resourceAgentId = req.params[agentIdField] || req.body[agentIdField];

            if (!hasResourceAccess(req, resourceUserId, resourceAgentId)) {
                return errorResponse(res, 403, 'You do not have access to this resource');
            }

            next();
        } catch (error) {
            logger.error('Resource access check error:', error);
            return errorResponse(res, 500, 'Access check failed');
        }
    };
};

module.exports = {
    authorize,
    hasResourceAccess,
    checkResourceAccess
};