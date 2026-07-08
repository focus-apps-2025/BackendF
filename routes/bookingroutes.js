// routes/bookingroutes.js
const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingcontroller');
const { authenticate } = require('../middleware/authmiddleware');
const { authorize } = require('../middleware/rbacmiddleware');
const { validate } = require('../middleware/validatemiddleware');
const { auditLog } = require('../middleware/auditLogmiddleware');
const Joi = require('joi');

// Simplified validation schemas
const createBookingSchema = Joi.object({
    boatId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            'any.required': 'Boat ID is required',
            'string.pattern.base': 'Invalid boat ID format'
        })
});

const bookingIdSchema = Joi.object({
    id: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            'any.required': 'Booking ID is required',
            'string.pattern.base': 'Invalid booking ID format'
        })
});

const boatIdSchema = Joi.object({
    boatId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            'any.required': 'Boat ID is required',
            'string.pattern.base': 'Invalid boat ID format'
        })
});

// All booking routes require authentication
router.use(authenticate);

// Get agent's bookings
router.get('/my-bookings',
    bookingController.getAgentBookings
);

// ✅ NEW: Get booking by boat ID (with agent details)
router.get('/boat/:boatId',
    validate(boatIdSchema, 'params'),
    bookingController.getBookingByBoatId
);

// ✅ NEW: Get ALL bookings for display (any agent)
router.get('/all-for-display',
    bookingController.getAllBookingsForDisplay  // ✅ Make sure this exists
);

// Create booking
router.post('/',
    authorize('COMMISSION_AGENT', 'SUPER_ADMIN'),
    validate(createBookingSchema),
    auditLog,
    bookingController.createBooking
);

// Delete booking
router.delete('/:id',
    authorize('COMMISSION_AGENT', 'SUPER_ADMIN'),
    validate(bookingIdSchema, 'params'),
    auditLog,
    bookingController.deleteBooking
);

// Check if boat is booked
router.get('/boat/:boatId/status',
    validate(boatIdSchema, 'params'),
    bookingController.checkBoatBooking
);

// Get all bookings (super admin only)
router.get('/all',
    authorize('SUPER_ADMIN'),
    bookingController.getAllBookings
);


router.get('/my-booked-boats',
    bookingController.getAgentBookedBoats
);
module.exports = router;