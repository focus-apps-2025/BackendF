const mongoose = require('mongoose');

const fishBuyerBillSchema = new mongoose.Schema({
    billNumber: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    buyerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fishId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Fish'
    },
    fishName: {
        type: String,
        required: true
    },
    weightKg: {
        type: Number,
        required: true,
        min: 0
    },
    pricePerKg: {
        type: Number,
        required: true,
        min: 0
    },
    totalAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        enum: ['CONFIRMED', 'CANCELLED'],
        default: 'CONFIRMED'
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
fishBuyerBillSchema.index({ billNumber: 1 }, { unique: true });
fishBuyerBillSchema.index({ buyerId: 1 });
fishBuyerBillSchema.index({ agentId: 1 });
fishBuyerBillSchema.index({ status: 1 });
fishBuyerBillSchema.index({ billDate: 1 });

const FishBuyerBill = mongoose.model('FishBuyerBill', fishBuyerBillSchema);
module.exports = FishBuyerBill;