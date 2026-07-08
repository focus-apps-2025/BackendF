// models/bookingmodel.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    bookingNumber: {
        type: String,
        unique: true,
        uppercase: true,
        sparse: true
    },
    boatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Boat',
        required: true
    },
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // ❌ NO ownerId
    bookingDate: {
        type: Date,
        default: Date.now
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexes
bookingSchema.index({ bookingNumber: 1 }, { unique: true, sparse: true });
bookingSchema.index({ boatId: 1 });
bookingSchema.index({ agentId: 1 });
bookingSchema.index({ isDeleted: 1 });

// ✅ Pre-save middleware to generate booking number
bookingSchema.pre('save', async function () {
    if (this.isNew && !this.bookingNumber) {
        try {
            const date = new Date();
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');

            const count = await this.constructor.countDocuments({ isDeleted: false });
            const sequence = String(count + 1).padStart(4, '0');

            this.bookingNumber = `BK${year}${month}${day}${sequence}`;
            console.log(`✅ Generated booking number: ${this.bookingNumber}`);
        } catch (error) {
            console.error('❌ Error generating booking number:', error);
            this.bookingNumber = `BK${Date.now()}`;
        }
    }
});

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;