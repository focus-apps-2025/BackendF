const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Indexes
locationSchema.index({ name: 1 }, { unique: true });
locationSchema.index({ isActive: 1 });

// Pre-remove middleware
locationSchema.pre('remove', async function (next) {
    // Check if any sub-locations exist
    const SubLocation = mongoose.model('SubLocation');
    const count = await SubLocation.countDocuments({ locationId: this._id });
    if (count > 0) {
        next(new Error('Cannot delete location with existing sub-locations'));
    }
    next();
});

const Location = mongoose.model('Location', locationSchema);
module.exports = Location;