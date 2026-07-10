const mongoose = require('mongoose');

const boatOwnerLedgerSchema = new mongoose.Schema({
    boatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Boat',
        required: true
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        default: Date.now,
        required: true
    },
    type: {
        type: String,
        enum: ['INCOME', 'EXPENSE'],
        required: true
    },
    category: {
        type: String,
        enum: [
            'FISH_SALE', 'OTHER_INCOME', // Income categories
            'DIESEL', 'FUEL', 'ICE', 'LABOUR', 'FOOD', 'REPAIR', 'MAINTENANCE', 'OTHER_EXPENSE' // Expense categories
        ],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

boatOwnerLedgerSchema.index({ boatId: 1, date: -1 });
boatOwnerLedgerSchema.index({ ownerId: 1, date: -1 });

const BoatOwnerLedger = mongoose.model('BoatOwnerLedger', boatOwnerLedgerSchema);
module.exports = BoatOwnerLedger;
