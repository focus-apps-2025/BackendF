const Location = require('../models/locationmodel');
const SubLocation = require('../models/subLocationmodel');
const logger = require('../config/logger');

class LocationService {
    /**
     * Create a new location
     * @param {Object} locationData - Location data
     * @param {string} userId - User ID creating the location
     * @returns {Promise<Object>} Created location
     */
    async createLocation(locationData, userId) {
        // Check if location already exists
        const existingLocation = await Location.findOne({
            name: locationData.name.toUpperCase(),
            isDeleted: false
        });

        if (existingLocation) {
            throw new Error('Location already exists');
        }

        const location = new Location({
            ...locationData,
            name: locationData.name.toUpperCase(),
            createdBy: userId
        });

        await location.save();

        logger.info(`Location created: ${location.name} by user ${userId}`);
        return location;
    }

    /**
     * Get all locations with sub-locations
     * @param {Object} filters - Filter parameters
     * @returns {Promise<Array>} List of locations with sub-locations
     */
    async getLocations(filters = {}) {
        const query = { isDeleted: false };

        if (filters.isActive !== undefined) {
            query.isActive = filters.isActive;
        }

        const locations = await Location.find(query)
            .sort({ name: 1 })
            .lean();

        // Get sub-locations for each location
        const locationsWithSubs = await Promise.all(
            locations.map(async (location) => {
                const subLocations = await SubLocation.find({
                    locationId: location._id,
                    isDeleted: false
                })
                    .sort({ name: 1 })
                    .lean();

                return {
                    ...location,
                    subLocations
                };
            })
        );

        return locationsWithSubs;
    }

    /**
     * Get location by ID with sub-locations
     * @param {string} locationId - Location ID
     * @returns {Promise<Object>} Location with sub-locations
     */
    async getLocationById(locationId) {
        const location = await Location.findOne({
            _id: locationId,
            isDeleted: false
        }).lean();

        if (!location) {
            throw new Error('Location not found');
        }

        const subLocations = await SubLocation.find({
            locationId: location._id,
            isDeleted: false
        })
            .sort({ name: 1 })
            .lean();

        return {
            ...location,
            subLocations
        };
    }

    /**
     * Update location
     * @param {string} locationId - Location ID
     * @param {Object} updateData - Update data
     * @returns {Promise<Object>} Updated location
     */
    async updateLocation(locationId, updateData) {
        const location = await Location.findOne({
            _id: locationId,
            isDeleted: false
        });

        if (!location) {
            throw new Error('Location not found');
        }

        // Check for duplicate name
        if (updateData.name) {
            const existingLocation = await Location.findOne({
                name: updateData.name.toUpperCase(),
                _id: { $ne: locationId },
                isDeleted: false
            });

            if (existingLocation) {
                throw new Error('Location name already exists');
            }
            location.name = updateData.name.toUpperCase();
        }

        if (updateData.isActive !== undefined) {
            location.isActive = updateData.isActive;
        }

        await location.save();

        logger.info(`Location updated: ${location.name}`);
        return location;
    }

    /**
     * Delete location (soft delete)
     * @param {string} locationId - Location ID
     * @returns {Promise<void>}
     */
    async deleteLocation(locationId) {
        const location = await Location.findOne({
            _id: locationId,
            isDeleted: false
        });

        if (!location) {
            throw new Error('Location not found');
        }

        // Check if location has sub-locations
        const subLocationCount = await SubLocation.countDocuments({
            locationId: locationId,
            isDeleted: false
        });

        if (subLocationCount > 0) {
            throw new Error('Cannot delete location with existing sub-locations');
        }

        // Check if location is used in any boat
        const Boat = require('../models/boat.model');
        const boatCount = await Boat.countDocuments({
            locationId: locationId,
            isDeleted: false
        });

        if (boatCount > 0) {
            throw new Error('Cannot delete location that is used by boats');
        }

        location.isDeleted = true;
        await location.save();

        logger.info(`Location deleted: ${location.name}`);
    }

    /**
     * Create a new sub-location
     * @param {Object} subLocationData - Sub-location data
     * @param {string} userId - User ID creating the sub-location
     * @returns {Promise<Object>} Created sub-location
     */
    async createSubLocation(subLocationData, userId) {
        // Validate location exists
        const location = await Location.findOne({
            _id: subLocationData.locationId,
            isDeleted: false,
            isActive: true
        });

        if (!location) {
            throw new Error('Location not found or inactive');
        }

        // Check if sub-location already exists for this location
        const existingSubLocation = await SubLocation.findOne({
            locationId: subLocationData.locationId,
            name: subLocationData.name.toUpperCase(),
            isDeleted: false
        });

        if (existingSubLocation) {
            throw new Error('Sub-location already exists for this location');
        }

        const subLocation = new SubLocation({
            ...subLocationData,
            name: subLocationData.name.toUpperCase(),
            createdBy: userId
        });

        await subLocation.save();

        logger.info(`Sub-location created: ${subLocation.name} under ${location.name} by user ${userId}`);
        return subLocation;
    }

    /**
     * Update sub-location
     * @param {string} subLocationId - Sub-location ID
     * @param {Object} updateData - Update data
     * @returns {Promise<Object>} Updated sub-location
     */
    async updateSubLocation(subLocationId, updateData) {
        const subLocation = await SubLocation.findOne({
            _id: subLocationId,
            isDeleted: false
        });

        if (!subLocation) {
            throw new Error('Sub-location not found');
        }

        // Check for duplicate name in same location
        if (updateData.name) {
            const existingSubLocation = await SubLocation.findOne({
                locationId: subLocation.locationId,
                name: updateData.name.toUpperCase(),
                _id: { $ne: subLocationId },
                isDeleted: false
            });

            if (existingSubLocation) {
                throw new Error('Sub-location name already exists for this location');
            }
            subLocation.name = updateData.name.toUpperCase();
        }

        if (updateData.isActive !== undefined) {
            subLocation.isActive = updateData.isActive;
        }

        await subLocation.save();

        logger.info(`Sub-location updated: ${subLocation.name}`);
        return subLocation;
    }

    /**
     * Delete sub-location (soft delete)
     * @param {string} subLocationId - Sub-location ID
     * @returns {Promise<void>}
     */
    async deleteSubLocation(subLocationId) {
        const subLocation = await SubLocation.findOne({
            _id: subLocationId,
            isDeleted: false
        });

        if (!subLocation) {
            throw new Error('Sub-location not found');
        }

        // Check if sub-location is used in any boat
        const Boat = require('../models/boat.model');
        const boatCount = await Boat.countDocuments({
            subLocationId: subLocationId,
            isDeleted: false
        });

        if (boatCount > 0) {
            throw new Error('Cannot delete sub-location that is used by boats');
        }

        subLocation.isDeleted = true;
        await subLocation.save();

        logger.info(`Sub-location deleted: ${subLocation.name}`);
    }

    /**
     * Get sub-locations by location ID
     * @param {string} locationId - Location ID
     * @param {Object} filters - Filter parameters
     * @returns {Promise<Array>} List of sub-locations
     */
    async getSubLocationsByLocation(locationId, filters = {}) {
        const query = {
            locationId,
            isDeleted: false
        };

        if (filters.isActive !== undefined) {
            query.isActive = filters.isActive;
        }

        return SubLocation.find(query)
            .sort({ name: 1 })
            .lean();
    }

    /**
     * Get location by name
     * @param {string} name - Location name
     * @returns {Promise<Object>} Location
     */
    async getLocationByName(name) {
        return Location.findOne({
            name: name.toUpperCase(),
            isDeleted: false
        }).lean();
    }

    /**
     * Get sub-location by name and location
     * @param {string} name - Sub-location name
     * @param {string} locationId - Location ID
     * @returns {Promise<Object>} Sub-location
     */
    async getSubLocationByName(name, locationId) {
        return SubLocation.findOne({
            locationId,
            name: name.toUpperCase(),
            isDeleted: false
        }).lean();
    }

    /**
     * Validate location and sub-location
     * @param {string} locationId - Location ID
     * @param {string} subLocationId - Sub-location ID
     * @returns {Promise<Object>} Validation result
     */
    async validateLocationSubLocation(locationId, subLocationId) {
        const location = await Location.findOne({
            _id: locationId,
            isDeleted: false,
            isActive: true
        });

        if (!location) {
            throw new Error('Invalid location');
        }

        if (subLocationId) {
            const subLocation = await SubLocation.findOne({
                _id: subLocationId,
                locationId: locationId,
                isDeleted: false,
                isActive: true
            });

            if (!subLocation) {
                throw new Error('Invalid sub-location for the given location');
            }

            return { location, subLocation };
        }

        return { location };
    }
}

module.exports = new LocationService();