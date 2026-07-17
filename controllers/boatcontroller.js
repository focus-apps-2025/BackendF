// controllers/boatcontroller.js

const BoatService = require('../services/boatservice');
const { successResponse, errorResponse } = require('../utils/responseutils');
const logger = require('../config/logger');

exports.getBoats = async (req, res, next) => {
    try {
        const { page, limit, search, status } = req.query;
        const userId = req.user._id;
        const userRole = req.user.role;

        // ✅ Filter boats based on user role
        let filter = {};

        if (userRole === 'BOAT_OWNER') {
            // Boat owners can only see their own boats
            filter.ownerId = userId;
        } else if (userRole === 'COMMISSION_AGENT') {
            // Commission agents can see boats under them
            filter.agentId = userId;
        } else if (userRole === 'STAFF') {
            // Staff can see boats under their agent
            filter.agentId = req.user.agentId;
        }
        // SUPER_ADMIN can see all boats

        const result = await BoatService.getBoats({
            ...filter,
            page,
            limit,
            search,
            status
        });

        return successResponse(res, 200, 'Boats retrieved successfully', result);
    } catch (error) {
        logger.error('Get boats error:', error);
        next(error);
    }
};

exports.createBoat = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const userRole = req.user.role;

        // ✅ Auto-assign ownerId for BOAT_OWNER
        let boatData = { ...req.body };

        if (userRole === 'BOAT_OWNER') {
            // Boat owners can only create boats for themselves
            boatData.ownerId = userId;

            // Optionally, they can choose an agent
            if (!boatData.agentId) {
                // If no agent specified, use the boat owner's agent
                boatData.agentId = req.user.agentId;
            }
        } else if (userRole === 'COMMISSION_AGENT' || userRole === 'SUPER_ADMIN') {
            // Agents and admins can create boats for any owner
            if (!boatData.ownerId) {
                return errorResponse(res, 400, 'Owner ID is required');
            }
        }

        // ✅ Validate that the boat owner exists
        const User = require('../models/usermodel');
        const owner = await User.findById(boatData.ownerId);
        if (!owner) {
            return errorResponse(res, 404, 'Boat owner not found');
        }

        // ✅ If owner is not BOAT_OWNER, update their role
        if (owner.role !== 'BOAT_OWNER') {
            owner.role = 'BOAT_OWNER';
            await owner.save();
            logger.info(`Updated user ${owner.email} role to BOAT_OWNER`);
        }

        const boat = await BoatService.createBoat(boatData, userId);
        return successResponse(res, 201, 'Boat created successfully', boat);
    } catch (error) {
        logger.error('Create boat error:', error);
        next(error);
    }
};

exports.getBoatById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const userRole = req.user.role;

        const boat = await BoatService.getBoatById(id);

        if (!boat) {
            return errorResponse(res, 404, 'Boat not found');
        }

        // ✅ Check if user has access to this boat
        const hasAccess = await BoatService.checkBoatAccess(boat, userId, userRole);
        if (!hasAccess) {
            return errorResponse(res, 403, 'You do not have access to this boat');
        }

        return successResponse(res, 200, 'Boat retrieved successfully', boat);
    } catch (error) {
        logger.error('Get boat by ID error:', error);
        next(error);
    }
};

exports.updateBoat = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const userRole = req.user.role;

        // ✅ Check if boat exists
        const existingBoat = await BoatService.getBoatById(id);
        if (!existingBoat) {
            return errorResponse(res, 404, 'Boat not found');
        }

        // ✅ Check if user has permission to update
        const hasAccess = await BoatService.checkBoatAccess(existingBoat, userId, userRole);
        if (!hasAccess) {
            return errorResponse(res, 403, 'You do not have permission to update this boat');
        }

        // ✅ Boat owners can only update certain fields
        let updateData = { ...req.body };
        if (userRole === 'BOAT_OWNER') {
            // Boat owners cannot change ownerId or agentId
            delete updateData.ownerId;
            delete updateData.agentId;
        }

        const boat = await BoatService.updateBoat(id, updateData, userId);
        return successResponse(res, 200, 'Boat updated successfully', boat);
    } catch (error) {
        logger.error('Update boat error:', error);
        next(error);
    }
};

exports.deleteBoat = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const userRole = req.user.role;

        // ✅ Check if boat exists
        const existingBoat = await BoatService.getBoatById(id);
        if (!existingBoat) {
            return errorResponse(res, 404, 'Boat not found');
        }

        // ✅ Check if user has permission to delete
        const hasAccess = await BoatService.checkBoatAccess(existingBoat, userId, userRole);
        if (!hasAccess) {
            return errorResponse(res, 403, 'You do not have permission to delete this boat');
        }

        // ✅ Check if boat has any active bookings
        const Booking = require('../models/bookingmodel');
        const activeBooking = await Booking.findOne({
            boatId: id,
            isDeleted: false
        });

        if (activeBooking) {
            return errorResponse(res, 409, 'Cannot delete boat with active bookings');
        }

        await BoatService.deleteBoat(id, userId);
        return successResponse(res, 200, 'Boat deleted successfully');
    } catch (error) {
        logger.error('Delete boat error:', error);
        next(error);
    }
};

// ✅ Get boat owners (for dropdown)
exports.getBoatOwners = async (req, res, next) => {
    try {
        const User = require('../models/usermodel');
        const owners = await User.find({
            role: 'BOAT_OWNER',
            isActive: true,
            isDeleted: false
        }).select('_id name email phone').lean();

        return successResponse(res, 200, 'Boat owners retrieved successfully', owners);
    } catch (error) {
        logger.error('Get boat owners error:', error);
        next(error);
    }
};

// ✅ Get boats by owner
exports.getBoatsByOwner = async (req, res, next) => {
    try {
        const { ownerId } = req.params;
        const userId = req.user._id;
        const userRole = req.user.role;

        // Check if user has access to this owner's boats
        if (userRole === 'BOAT_OWNER' && ownerId !== userId.toString()) {
            return errorResponse(res, 403, 'You can only view your own boats');
        }

        const boats = await BoatService.getBoatsByOwner(ownerId);
        return successResponse(res, 200, 'Boats retrieved successfully', boats);
    } catch (error) {
        logger.error('Get boats by owner error:', error);
        next(error);
    }
};

// ✅ GET BOATS BY AGENT - ADD THIS METHOD
exports.getBoatsByAgent = async (req, res, next) => {
    try {
        const { agentId } = req.params;
        const userId = req.user._id;
        const userRole = req.user.role;

        // Check if user has access to this agent's boats
        if (userRole === 'COMMISSION_AGENT' && agentId !== userId.toString()) {
            return errorResponse(res, 403, 'You can only view boats under your agency');
        }

        if (userRole === 'STAFF' && req.user.agentId) {
            // Staff can only view boats under their agent
            if (agentId !== req.user.agentId.toString()) {
                return errorResponse(res, 403, 'You can only view boats under your agent');
            }
        }

        const boats = await BoatService.getBoatsByAgent(agentId);
        return successResponse(res, 200, 'Boats retrieved successfully', boats);
    } catch (error) {
        logger.error('Get boats by agent error:', error);
        next(error);
    }
};

// ✅ Toggle boat status (Active/Inactive)
exports.toggleBoatStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        const userRole = req.user.role;

        const existingBoat = await BoatService.getBoatById(id);
        if (!existingBoat) {
            return errorResponse(res, 404, 'Boat not found');
        }

        const hasAccess = await BoatService.checkBoatAccess(existingBoat, userId, userRole);
        if (!hasAccess) {
            return errorResponse(res, 403, 'You do not have access to this boat');
        }

        const boat = await BoatService.toggleBoatStatus(id, userId);
        return successResponse(res, 200, 'Boat status updated successfully', boat);
    } catch (error) {
        logger.error('Toggle boat status error:', error);
        next(error);
    }
};