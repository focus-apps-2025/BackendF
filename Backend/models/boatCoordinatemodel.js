const mongoose = require('mongoose');

const boatCoordinateSchema = new mongoose.Schema({
    boatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Boat',
        required: true
    },
    latitude: {
        type: Number,
        required: true,
        min: -90,
        max: 90
    },
    longitude: {
        type: Number,
        required: true,
        min: -180,
        max: 180
    },
    speed: {
        type: Number,
        min: 0
    },
    heading: {
        type: Number,
        min: 0,
        max: 360
    },
    recordedAt: {
        type: Date,
        default: Date.now,
        required: true
    }
}, {
    timestamps: true
});

// Indexes
boatCoordinateSchema.index({ boatId: 1, recordedAt: -1 });
boatCoordinateSchema.index({ boatId: 1, recordedAt: -1 }, {
    unique: true,
    partialFilterExpression: { recordedAt: { $exists: true } }
});

// TTL index to auto-delete old coordinates (after 30 days)
boatCoordinateSchema.index({ recordedAt: 1 }, { expireAfterSeconds: 2592000 });

// Static method to get latest coordinates
boatCoordinateSchema.statics.getLatest = function (boatId) {
    return this.findOne({ boatId })
        .sort({ recordedAt: -1 })
        .lean();
};

// Static method to get coordinates in time range
boatCoordinateSchema.statics.getInRange = function (boatId, startDate, endDate) {
    return this.find({
        boatId,
        recordedAt: {
            $gte: startDate,
            $lte: endDate
        }
    })
        .sort({ recordedAt: 1 })
        .lean();
};

const BoatCoordinate = mongoose.model('BoatCoordinate', boatCoordinateSchema);
module.exports = BoatCoordinate;