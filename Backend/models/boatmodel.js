const mongoose = require('mongoose');

const boatSchema = new mongoose.Schema({
    boatNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        uppercase: true
    },
    boatName: {
        type: String,
        required: true,
        trim: true
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
agentId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'User',
         required: false
     },
     locationId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'Location',
         required: false
     },
     subLocationId: {
         type: mongoose.Schema.Types.ObjectId,
         ref: 'SubLocation',
         required: false
     },
    registrationNumber: {
        type: String,
        trim: true
    },
    capacity: {
        type: Number,
        min: 0
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
boatSchema.index({ boatNumber: 1 }, { unique: true });
boatSchema.index({ ownerId: 1 });
boatSchema.index({ agentId: 1 });
boatSchema.index({ locationId: 1 });
boatSchema.index({ isActive: 1 });

// Virtual for full boat display
boatSchema.virtual('displayName').get(function () {
    return `${this.boatNumber} - ${this.boatName}`;
});

// To JSON
boatSchema.set('toJSON', { virtuals: true });

const Boat = mongoose.model('Boat', boatSchema);
module.exports = Boat;