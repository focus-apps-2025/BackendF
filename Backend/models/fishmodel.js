const mongoose = require('mongoose');

const fishSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        uppercase: true
    },
    localName: {
        type: String,
        trim: true
    },
    pricePerKg: {
        type: Number,
        required: true,
        min: 0
    },
    category: {
        type: String,
        trim: true,
        uppercase: true
    },
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Indexes
fishSchema.index({ name: 1, agentId: 1 }, { unique: true });
fishSchema.index({ agentId: 1 });
fishSchema.index({ category: 1 });
fishSchema.index({ isActive: 1 });

const Fish = mongoose.model('Fish', fishSchema);
module.exports = Fish;