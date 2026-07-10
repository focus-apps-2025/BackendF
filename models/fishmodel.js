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
        // ✅ CHANGE: Make it optional (not required)
        required: false
    },
    // ✅ NEW: Track who created the fish
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // ✅ NEW: For global fish visibility
    isGlobal: {
        type: Boolean,
        default: false
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
// ✅ Update unique index to handle null agentId
fishSchema.index({ name: 1, agentId: 1 }, {
    unique: true,
    sparse: true  // ✅ Allows null values
});
fishSchema.index({ agentId: 1 });
fishSchema.index({ category: 1 });
fishSchema.index({ isActive: 1 });
fishSchema.index({ createdBy: 1 });  // ✅ NEW INDEX
fishSchema.index({ isGlobal: 1 });   // ✅ NEW INDEX

const Fish = mongoose.model('Fish', fishSchema);
module.exports = Fish;