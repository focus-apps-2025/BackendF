const mongoose = require('mongoose');

const ledgerSchema = new mongoose.Schema({
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
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    billId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Bill'
    },
    type: {
        type: String,
        enum: ['CREDIT', 'DEBIT'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    balance: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        trim: true,
        required: true
    },
    date: {
        type: Date,
        default: Date.now,
        required: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexes
ledgerSchema.index({ boatId: 1, date: -1 });
ledgerSchema.index({ ownerId: 1, date: -1 });
ledgerSchema.index({ agentId: 1 });
ledgerSchema.index({ billId: 1 });

const Ledger = mongoose.model('Ledger', ledgerSchema);
module.exports = Ledger;