const mongoose = require('mongoose');

const subLocationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        uppercase: true
    },
    locationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        required: true
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

// Compound index for unique sub-location per location
subLocationSchema.index({ locationId: 1, name: 1 }, { unique: true });
subLocationSchema.index({ isActive: 1 });

const SubLocation = mongoose.model('SubLocation', subLocationSchema);
module.exports = SubLocation;