// controllers/bookingcontroller.js
const bookingService = require('../services/bookingservice');
const { successResponse, errorResponse } = require('../utils/responseutils');
const logger = require('../config/logger');

/**
 * Create booking - Immediate booking
 */
const createBooking = async (req, res, next) => {
    try {
        const booking = await bookingService.createBooking(req.body, req.user);
        successResponse(res, 201, 'Boat booked successfully', booking);
    } catch (error) {
        logger.error('Create booking error:', error);
        const statusCode = error.statusCode || 400;
        errorResponse(res, statusCode, error.message || 'Failed to book boat');
    }
};

/**
 * Get agent bookings
 */
const getAgentBookings = async (req, res, next) => {
    try {
        const bookings = await bookingService.getAgentBookings(req.user._id);
        successResponse(res, 200, 'Bookings retrieved successfully', bookings);
    } catch (error) {
        logger.error('Get agent bookings error:', error);
        errorResponse(res, 500, error.message || 'Failed to get bookings');
    }
};


/**
 * Get booking by boat ID (with agent details)
 */
const getBookingByBoatId = async (req, res, next) => {
    try {
        const booking = await bookingService.getBookingByBoatId(req.params.boatId);
        if (!booking) {
            return successResponse(res, 200, 'Boat is not booked', null);
        }
        successResponse(res, 200, 'Booking details retrieved', booking);
    } catch (error) {
        logger.error('Get booking by boat ID error:', error);
        errorResponse(res, 500, error.message || 'Failed to get booking details');
    }
};

/**
 * Delete booking - Immediate removal
 */
const deleteBooking = async (req, res, next) => {
    try {
        await bookingService.deleteBooking(req.params.id, req.user);
        successResponse(res, 200, 'Booking removed successfully');
    } catch (error) {
        logger.error('Delete booking error:', error);
        const statusCode = error.statusCode || 400;
        errorResponse(res, statusCode, error.message || 'Failed to remove booking');
    }
};

/**
 * Get all bookings (super admin only)
 */
const getAllBookings = async (req, res, next) => {
    try {
        const bookings = await bookingService.getAllBookings();
        successResponse(res, 200, 'All bookings retrieved successfully', bookings);
    } catch (error) {
        logger.error('Get all bookings error:', error);
        errorResponse(res, 500, error.message || 'Failed to get bookings');
    }
};

/**
 * ✅ NEW: Get ALL bookings for display (any agent)
 * This returns all bookings regardless of which agent created them
 */
const getAllBookingsForDisplay = async (req, res, next) => {
    try {
        const bookings = await bookingService.getAllBookingsForDisplay();
        successResponse(res, 200, 'All bookings retrieved successfully', bookings);
    } catch (error) {
        logger.error('Get all bookings for display error:', error);
        errorResponse(res, 500, error.message || 'Failed to get bookings');
    }
};

/**
 * Check if boat is booked
 */
const checkBoatBooking = async (req, res, next) => {
    try {
        const isBooked = await bookingService.isBoatBooked(req.params.boatId);
        successResponse(res, 200, 'Boat booking status retrieved', { isBooked });
    } catch (error) {
        logger.error('Check boat booking error:', error);
        errorResponse(res, 500, error.message || 'Failed to check booking status');
    }
};

const getAgentBookedBoats = async (req, res, next) => {
    try {
        const targetAgentId = req.user.role === 'STAFF' && req.user.agentId
            ? req.user.agentId
            : req.user._id;
        const boats = await bookingService.getAgentBookedBoats(targetAgentId);
        successResponse(res, 200, 'Booked boats retrieved successfully', boats);
    } catch (error) {
        logger.error('Get agent booked boats error:', error);
        errorResponse(res, 500, error.message || 'Failed to get booked boats');
    }
};

module.exports = {
    createBooking,
    getAgentBookings,
    getBookingByBoatId,
    deleteBooking,
    getAllBookings,
    getAllBookingsForDisplay,
    checkBoatBooking,
    getAgentBookedBoats  // ✅ NEW
};