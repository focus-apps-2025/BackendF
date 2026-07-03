const BoatCoordinate = require('../models/boatCoordinatemodel');
const Boat = require('../models/boatmodel');
const User = require('../models/usermodel');
const logger = require('../config/logger');

class TrackingService {
    /**
     * Submit coordinates for a boat
     * @param {string} boatId - Boat ID
     * @param {Object} coordinateData - Coordinate data
     * @param {Object} user - Current user
     * @returns {Promise<Object>} Created coordinate
     */
    async submitCoordinates(boatId, coordinateData, user) {
        // Validate boat exists
        const boat = await Boat.findOne({
            _id: boatId,
            isDeleted: false,
            isActive: true
        });

        if (!boat) {
            throw new Error('Boat not found or inactive');
        }

        // Check if user has permission to submit coordinates
        // Boat owners can submit for their boats, agents can submit for their boats
        if (user) {
            const hasAccess = (
                user.role === 'SUPER_ADMIN' ||
                boat.ownerId.toString() === user._id.toString() ||
                (user.role === 'COMMISSION_AGENT' && boat.agentId.toString() === user._id.toString())
            );

            if (!hasAccess) {
                throw new Error('You do not have permission to submit coordinates for this boat');
            }
        }

        // Validate coordinates
        if (coordinateData.latitude < -90 || coordinateData.latitude > 90) {
            throw new Error('Invalid latitude. Must be between -90 and 90');
        }

        if (coordinateData.longitude < -180 || coordinateData.longitude > 180) {
            throw new Error('Invalid longitude. Must be between -180 and 180');
        }

        // Create coordinate entry
        const coordinate = new BoatCoordinate({
            boatId,
            latitude: coordinateData.latitude,
            longitude: coordinateData.longitude,
            speed: coordinateData.speed || 0,
            heading: coordinateData.heading || 0,
            recordedAt: coordinateData.recordedAt || new Date()
        });

        await coordinate.save();

        logger.info(`Coordinates submitted for boat ${boat.boatNumber} by user ${user?._id || 'anonymous'}`);

        return coordinate;
    }

    /**
     * Get latest coordinates for a boat
     * @param {string} boatId - Boat ID
     * @param {Object} user - Current user
     * @returns {Promise<Object>} Latest coordinates
     */
    async getLatestCoordinates(boatId, user) {
        // Validate boat exists and user has access
        const boat = await this.validateBoatAccess(boatId, user);

        const coordinate = await BoatCoordinate.getLatest(boatId);

        if (!coordinate) {
            throw new Error('No coordinates found for this boat');
        }

        return {
            boat: {
                id: boat._id,
                boatNumber: boat.boatNumber,
                boatName: boat.boatName
            },
            coordinate: {
                latitude: coordinate.latitude,
                longitude: coordinate.longitude,
                speed: coordinate.speed,
                heading: coordinate.heading,
                recordedAt: coordinate.recordedAt
            }
        };
    }

    /**
     * Get coordinates history for a boat
     * @param {string} boatId - Boat ID
     * @param {Object} filters - Filter parameters (hours, startDate, endDate)
     * @param {Object} user - Current user
     * @returns {Promise<Array>} Coordinates history
     */
    async getCoordinatesHistory(boatId, filters, user) {
        // Validate boat exists and user has access
        const boat = await this.validateBoatAccess(boatId, user);

        let startDate, endDate;

        if (filters.hours) {
            // Get coordinates for last N hours
            const hours = parseInt(filters.hours);
            if (isNaN(hours) || hours < 1 || hours > 168) {
                throw new Error('Hours must be between 1 and 168');
            }

            startDate = new Date();
            startDate.setHours(startDate.getHours() - hours);
            endDate = new Date();
        } else if (filters.startDate && filters.endDate) {
            // Get coordinates for specific date range
            startDate = new Date(filters.startDate);
            endDate = new Date(filters.endDate);

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                throw new Error('Invalid date format');
            }

            if (startDate > endDate) {
                throw new Error('Start date must be before end date');
            }

            const diffDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
            if (diffDays > 30) {
                throw new Error('Date range cannot exceed 30 days');
            }
        } else {
            // Default to last 24 hours
            startDate = new Date();
            startDate.setHours(startDate.getHours() - 24);
            endDate = new Date();
        }

        const coordinates = await BoatCoordinate.getInRange(boatId, startDate, endDate);

        // Format response
        const history = coordinates.map(coord => ({
            latitude: coord.latitude,
            longitude: coord.longitude,
            speed: coord.speed,
            heading: coord.heading,
            recordedAt: coord.recordedAt
        }));

        // Calculate distance traveled if there are at least 2 points
        let distance = 0;
        if (history.length >= 2) {
            for (let i = 1; i < history.length; i++) {
                distance += this.calculateDistance(
                    history[i - 1].latitude,
                    history[i - 1].longitude,
                    history[i].latitude,
                    history[i].longitude
                );
            }
        }

        return {
            boat: {
                id: boat._id,
                boatNumber: boat.boatNumber,
                boatName: boat.boatName
            },
            period: {
                startDate,
                endDate
            },
            history,
            summary: {
                totalPoints: history.length,
                distanceTraveled: Math.round(distance * 100) / 100, // km
                averageSpeed: history.length > 0
                    ? Math.round((history.reduce((sum, h) => sum + (h.speed || 0), 0) / history.length) * 100) / 100
                    : 0
            }
        };
    }

    /**
     * Get all boats with latest coordinates
     * @param {Object} user - Current user
     * @returns {Promise<Array>} Boats with latest coordinates
     */
    async getAllBoatLocations(user) {
        // Build query based on user role
        const boatQuery = { isDeleted: false, isActive: true };

        if (user.role === 'COMMISSION_AGENT') {
            boatQuery.agentId = user._id;
        } else if (user.role === 'BOAT_OWNER') {
            boatQuery.ownerId = user._id;
        } else if (user.role === 'STAFF' && user.agentId) {
            boatQuery.agentId = user.agentId;
        } else if (user.role !== 'SUPER_ADMIN') {
            throw new Error('Access denied');
        }

        // Get all boats
        const boats = await Boat.find(boatQuery)
            .populate('ownerId', 'name email phone')
            .populate('agentId', 'name email')
            .populate('locationId', 'name')
            .populate('subLocationId', 'name')
            .lean();

        // Get latest coordinates for each boat
        const boatLocations = await Promise.all(
            boats.map(async (boat) => {
                const coordinate = await BoatCoordinate.getLatest(boat._id);

                return {
                    boat: {
                        id: boat._id,
                        boatNumber: boat.boatNumber,
                        boatName: boat.boatName,
                        owner: boat.ownerId,
                        agent: boat.agentId,
                        location: boat.locationId,
                        subLocation: boat.subLocationId
                    },
                    location: coordinate ? {
                        latitude: coordinate.latitude,
                        longitude: coordinate.longitude,
                        speed: coordinate.speed,
                        heading: coordinate.heading,
                        recordedAt: coordinate.recordedAt
                    } : null,
                    isActive: boat.isActive,
                    lastUpdate: coordinate ? coordinate.recordedAt : null
                };
            })
        );

        // Filter out boats with no coordinates (optional)
        // const activeLocations = boatLocations.filter(b => b.location !== null);

        return boatLocations;
    }

    /**
     * Get boat location status (active/inactive)
     * @param {string} boatId - Boat ID
     * @param {number} minutesThreshold - Minutes threshold for active status (default: 30)
     * @param {Object} user - Current user
     * @returns {Promise<Object>} Boat status
     */
    async getBoatStatus(boatId, minutesThreshold = 30, user) {
        // Validate boat exists and user has access
        const boat = await this.validateBoatAccess(boatId, user);

        const coordinate = await BoatCoordinate.getLatest(boatId);

        if (!coordinate) {
            return {
                boat: {
                    id: boat._id,
                    boatNumber: boat.boatNumber,
                    boatName: boat.boatName
                },
                status: 'UNKNOWN',
                lastUpdate: null,
                message: 'No coordinates reported yet'
            };
        }

        const lastUpdate = new Date(coordinate.recordedAt);
        const now = new Date();
        const minutesDiff = (now - lastUpdate) / (1000 * 60);

        let status, message;
        if (minutesDiff <= minutesThreshold) {
            status = 'ACTIVE';
            message = `Last update ${Math.round(minutesDiff)} minutes ago`;
        } else if (minutesDiff <= minutesThreshold * 2) {
            status = 'STALE';
            message = `Last update ${Math.round(minutesDiff)} minutes ago`;
        } else {
            status = 'INACTIVE';
            message = `No updates for ${Math.round(minutesDiff)} minutes`;
        }

        return {
            boat: {
                id: boat._id,
                boatNumber: boat.boatNumber,
                boatName: boat.boatName
            },
            status,
            message,
            lastUpdate,
            coordinates: {
                latitude: coordinate.latitude,
                longitude: coordinate.longitude,
                speed: coordinate.speed,
                heading: coordinate.heading
            }
        };
    }

    /**
     * Validate boat access for user
     * @param {string} boatId - Boat ID
     * @param {Object} user - Current user
     * @returns {Promise<Object>} Boat document
     * @throws {Error} If boat not found or access denied
     */
    async validateBoatAccess(boatId, user) {
        const boat = await Boat.findOne({
            _id: boatId,
            isDeleted: false
        });

        if (!boat) {
            throw new Error('Boat not found');
        }

        // Check access
        if (user.role === 'SUPER_ADMIN') {
            return boat;
        }

        const hasAccess = (
            boat.ownerId.toString() === user._id.toString() ||
            boat.agentId.toString() === user._id.toString() ||
            (user.role === 'STAFF' && user.agentId && boat.agentId.toString() === user.agentId.toString())
        );

        if (!hasAccess) {
            throw new Error('Access denied');
        }

        return boat;
    }

    /**
     * Calculate distance between two coordinates using Haversine formula
     * @param {number} lat1 - Latitude of point 1
     * @param {number} lon1 - Longitude of point 1
     * @param {number} lat2 - Latitude of point 2
     * @param {number} lon2 - Longitude of point 2
     * @returns {number} Distance in kilometers
     */
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(lat2 - lat1);
        const dLon = this.toRadians(lon2 - lon1);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return distance;
    }

    /**
     * Convert degrees to radians
     * @param {number} degrees - Degrees
     * @returns {number} Radians
     */
    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Get boats near a location
     * @param {number} latitude - Center latitude
     * @param {number} longitude - Center longitude
     * @param {number} radiusKm - Radius in kilometers
     * @param {Object} user - Current user
     * @returns {Promise<Array>} Boats near location
     */
    async getBoatsNearLocation(latitude, longitude, radiusKm = 10, user) {
        // Validate coordinates
        if (latitude < -90 || latitude > 90) {
            throw new Error('Invalid latitude');
        }
        if (longitude < -180 || longitude > 180) {
            throw new Error('Invalid longitude');
        }
        if (radiusKm < 0 || radiusKm > 100) {
            throw new Error('Radius must be between 0 and 100 km');
        }

        // Get all boats user has access to
        const boatQuery = { isDeleted: false, isActive: true };

        if (user.role === 'COMMISSION_AGENT') {
            boatQuery.agentId = user._id;
        } else if (user.role === 'BOAT_OWNER') {
            boatQuery.ownerId = user._id;
        } else if (user.role === 'STAFF' && user.agentId) {
            boatQuery.agentId = user.agentId;
        } else if (user.role !== 'SUPER_ADMIN') {
            throw new Error('Access denied');
        }

        const boats = await Boat.find(boatQuery).lean();

        // Get latest coordinates for each boat and calculate distance
        const boatsWithDistance = await Promise.all(
            boats.map(async (boat) => {
                const coordinate = await BoatCoordinate.getLatest(boat._id);

                if (!coordinate) {
                    return null;
                }

                const distance = this.calculateDistance(
                    latitude,
                    longitude,
                    coordinate.latitude,
                    coordinate.longitude
                );

                if (distance <= radiusKm) {
                    return {
                        boat: {
                            id: boat._id,
                            boatNumber: boat.boatNumber,
                            boatName: boat.boatName
                        },
                        location: {
                            latitude: coordinate.latitude,
                            longitude: coordinate.longitude,
                            speed: coordinate.speed,
                            heading: coordinate.heading,
                            recordedAt: coordinate.recordedAt
                        },
                        distance: Math.round(distance * 100) / 100
                    };
                }
                return null;
            })
        );

        // Filter out null values and sort by distance
        return boatsWithDistance
            .filter(b => b !== null)
            .sort((a, b) => a.distance - b.distance);
    }

    /**
     * Get coordinates for all boats (for map display)
     * @param {Object} user - Current user
     * @param {boolean} includeInactive - Include inactive boats
     * @returns {Promise<Array>} Coordinates for map
     */
    async getMapCoordinates(user, includeInactive = false) {
        // Build boat query
        const boatQuery = { isDeleted: false };

        if (!includeInactive) {
            boatQuery.isActive = true;
        }

        if (user.role === 'COMMISSION_AGENT') {
            boatQuery.agentId = user._id;
        } else if (user.role === 'BOAT_OWNER') {
            boatQuery.ownerId = user._id;
        } else if (user.role === 'STAFF' && user.agentId) {
            boatQuery.agentId = user.agentId;
        } else if (user.role !== 'SUPER_ADMIN') {
            throw new Error('Access denied');
        }

        const boats = await Boat.find(boatQuery)
            .populate('ownerId', 'name')
            .lean();

        const coordinates = await Promise.all(
            boats.map(async (boat) => {
                const coordinate = await BoatCoordinate.getLatest(boat._id);

                if (!coordinate) {
                    return null;
                }

                return {
                    boatId: boat._id,
                    boatNumber: boat.boatNumber,
                    boatName: boat.boatName,
                    ownerName: boat.ownerId?.name || 'Unknown',
                    isActive: boat.isActive,
                    latitude: coordinate.latitude,
                    longitude: coordinate.longitude,
                    speed: coordinate.speed,
                    heading: coordinate.heading,
                    recordedAt: coordinate.recordedAt
                };
            })
        );

        return coordinates.filter(c => c !== null);
    }

    /**
     * Get trip summary for a boat
     * @param {string} boatId - Boat ID
     * @param {Object} user - Current user
     * @param {Date} startDate - Start date (optional)
     * @param {Date} endDate - End date (optional)
     * @returns {Promise<Object>} Trip summary
     */
    async getTripSummary(boatId, user, startDate = null, endDate = null) {
        // Validate boat exists and user has access
        await this.validateBoatAccess(boatId, user);

        // Set default dates (last 24 hours if not specified)
        if (!startDate) {
            startDate = new Date();
            startDate.setHours(startDate.getHours() - 24);
        }
        if (!endDate) {
            endDate = new Date();
        }

        const coordinates = await BoatCoordinate.getInRange(boatId, startDate, endDate);

        if (coordinates.length === 0) {
            return {
                boatId,
                period: { startDate, endDate },
                summary: {
                    totalPoints: 0,
                    distanceTraveled: 0,
                    averageSpeed: 0,
                    maxSpeed: 0,
                    duration: 0,
                    movingTime: 0
                },
                path: []
            };
        }

        // Calculate trip metrics
        let totalDistance = 0;
        let maxSpeed = 0;
        let movingTime = 0;
        const speedThreshold = 0.5; // km/h threshold for moving

        for (let i = 1; i < coordinates.length; i++) {
            const dist = this.calculateDistance(
                coordinates[i - 1].latitude,
                coordinates[i - 1].longitude,
                coordinates[i].latitude,
                coordinates[i].longitude
            );

            totalDistance += dist;

            // Calculate speed between points
            const timeDiff = (coordinates[i].recordedAt - coordinates[i - 1].recordedAt) / (1000 * 60 * 60); // hours
            if (timeDiff > 0) {
                const speed = dist / timeDiff;
                if (speed > maxSpeed) maxSpeed = speed;
                if (speed > speedThreshold) {
                    movingTime += timeDiff;
                }
            }
        }

        const duration = (coordinates[coordinates.length - 1].recordedAt - coordinates[0].recordedAt) / (1000 * 60 * 60); // hours

        return {
            boatId,
            period: { startDate, endDate },
            summary: {
                totalPoints: coordinates.length,
                distanceTraveled: Math.round(totalDistance * 100) / 100,
                averageSpeed: duration > 0 ? Math.round((totalDistance / duration) * 100) / 100 : 0,
                maxSpeed: Math.round(maxSpeed * 100) / 100,
                duration: Math.round(duration * 100) / 100,
                movingTime: Math.round(movingTime * 100) / 100
            },
            path: coordinates.map(coord => ({
                latitude: coord.latitude,
                longitude: coord.longitude,
                speed: coord.speed,
                heading: coord.heading,
                recordedAt: coord.recordedAt
            }))
        };
    }
}

module.exports = new TrackingService();