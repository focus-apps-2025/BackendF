const mongoose = require('mongoose');

const fishEntrySchema = new mongoose.Schema({
    fishId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Fish'
    },
    fishName: {
        type: String
    },
    weightKg: {
        type: Number
    },
    pricePerKg: {
        type: Number
    },
    totalAmount: {
        type: Number
    }
}, {
    _id: false
});

const billSchema = new mongoose.Schema({
    billNumber: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
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
    staffId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    buyerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    locationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location'
    },
    subLocationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubLocation'
    },
    fishEntries: [fishEntrySchema],
    subtotal: {
        type: Number
    },
    commissionRate: {
        type: Number,
        default: 0
    },
    commissionAmount: {
        type: Number,
        default: 0
    },
    grandTotal: {
        type: Number
    },
    status: {
        type: String,
        enum: ['CONFIRMED', 'CANCELLED'],
        default: 'CONFIRMED'
    },
    paymentMethod: {
        type: String,
        enum: ['CASH', 'BANK_TRANSFER', 'UPI']
    },
    notes: {
        type: String,
        trim: true
    },
    billDate: {
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
billSchema.index({ billNumber: 1 }, { unique: true });
billSchema.index({ boatId: 1 });
billSchema.index({ agentId: 1 });
billSchema.index({ buyerId: 1 });
billSchema.index({ status: 1 });
billSchema.index({ billDate: 1 });
billSchema.index({ locationId: 1 });
billSchema.index({ 'fishEntries.fishId': 1 });

const Bill = mongoose.model('Bill', billSchema);
module.exports = Bill;