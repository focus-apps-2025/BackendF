// models/fishingLocationmodel.js

const mongoose = require('mongoose');

const fishingLocationSchema = new mongoose.Schema({
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
    }
}, {
    timestamps: true
});

//  UNIQUE INDEX: One location per boat per day
fishingLocationSchema.index(
    { boatId: 1, date: 1 }, 
    { unique: true }
);

fishingLocationSchema.index({ ownerId: 1 });
fishingLocationSchema.index({ date: -1 });

const FishingLocation = mongoose.model('FishingLocation', fishingLocationSchema);
module.exports = FishingLocation;