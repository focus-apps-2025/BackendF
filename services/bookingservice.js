// services/bookingservice.js
const Booking = require('../models/bookingmodel');
const Boat = require('../models/boatmodel');
const { AppError, NotFoundError, ConflictError } = require('../utils/errors');
const logger = require('../config/logger');

class BookingService {

    /**
     * Create a new boat booking - IMMEDIATE BOOKING
     */
    async createBooking(data, user) {
        const { boatId } = data;

        const boat = await Boat.findOne({
            _id: boatId,
            isActive: true,
            isDeleted: false
        });

        if (!boat) {
            throw new NotFoundError('Boat not found or inactive');
        }

        const existingBooking = await Booking.findOne({
            boatId: boatId,
            isDeleted: false
        });

        if (existingBooking) {
            throw new ConflictError('This boat is already booked');
        }

        const booking = new Booking({
            boatId,
            agentId: user._id,
            bookingDate: new Date()
        });

        await booking.save();

        const populatedBooking = await Booking.findById(booking._id)
            .populate('boatId', 'boatName boatNumber registrationNumber capacity')
            .populate('agentId', 'name email phone');

        logger.info(`Boat booked: ${booking.bookingNumber} - ${boat.boatNumber} by ${user.email}`);
        return populatedBooking;
    }

    /**
     * Get all bookings for an agent
     */
    async getAgentBookings(agentId) {
        const bookings = await Booking.find({
            agentId,
            isDeleted: false
        })
            .populate('boatId', 'boatName boatNumber registrationNumber capacity')
            .populate('agentId', 'name email phone')
            .sort({ createdAt: -1 });

        return bookings;
    }

    /**
     * Get booking by boat ID with agent details
     */
    async getBookingByBoatId(boatId) {
        const booking = await Booking.findOne({
            boatId: boatId,
            isDeleted: false
        })
            .populate('boatId', 'boatName boatNumber')
            .populate('agentId', 'name email phone');

        return booking;
    }

    /**
     * ✅ NEW: Get ALL bookings for display (any agent)
     */
    async getAllBookingsForDisplay() {
        const bookings = await Booking.find({ isDeleted: false })
            .populate('boatId', 'boatName boatNumber registrationNumber capacity')
            .populate('agentId', 'name email phone')
            .sort({ createdAt: -1 });

        return bookings;
    }
    async getAgentBookedBoats(agentId) {
        const bookings = await Booking.find({
            agentId: agentId,
            isDeleted: false
        })
            .populate('boatId', 'boatName boatNumber registrationNumber capacity')
            .sort({ createdAt: -1 });

        // Return only the boat objects
        return bookings.map(b => b.boatId).filter(b => b !== null);
    }

    /**
     * Get all bookings for an agent (with full details)
     */
    async getAgentBookings(agentId) {
        const bookings = await Booking.find({
            agentId,
            isDeleted: false
        })
            .populate('boatId', 'boatName boatNumber registrationNumber capacity')
            .populate('agentId', 'name email phone')
            .sort({ createdAt: -1 });

        return bookings;
    }
    /**
     * Get all bookings (for super admin)
     */
    async getAllBookings() {
        const bookings = await Booking.find({ isDeleted: false })
            .populate('boatId', 'boatName boatNumber')
            .populate('agentId', 'name email')
            .sort({ createdAt: -1 });

        return bookings;
    }

    /**
     * Delete booking - IMMEDIATE REMOVAL
     */
    async deleteBooking(id, user) {
        const booking = await Booking.findOne({
            _id: id,
            isDeleted: false
        });

        if (!booking) {
            throw new NotFoundError('Booking not found');
        }

        if (user.role !== 'SUPER_ADMIN' && booking.agentId.toString() !== user._id.toString()) {
            throw new AppError('You are not authorized to delete this booking', 403);
        }

        await Booking.deleteOne({ _id: id });

        logger.info(`Booking ${booking.bookingNumber} deleted by ${user.email}`);
        return booking;
    }

    /**
     * Check if boat is booked
     */
    async isBoatBooked(boatId) {
        const booking = await Booking.findOne({
            boatId,
            isDeleted: false
        });
        return !!booking;
    }
}

module.exports = new BookingService();