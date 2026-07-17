// services/boatservice.js
const Boat = require('../models/boatmodel');
const User = require('../models/usermodel');

class BoatService {
    static async getBoats({ ownerId, agentId, page = 1, limit = 10, search = '', status }) {
        const skip = (page - 1) * limit;
        const filter = { isDeleted: false };

        if (ownerId) filter.ownerId = ownerId;
        if (agentId) filter.agentId = agentId;
        if (status === 'active') filter.isActive = true;
        if (status === 'inactive') filter.isActive = false;
        if (search) {
            filter.$or = [
                { boatNumber: { $regex: search, $options: 'i' } },
                { boatName: { $regex: search, $options: 'i' } },
                { registrationNumber: { $regex: search, $options: 'i' } }
            ];
        }

        const [boats, total] = await Promise.all([
            Boat.find(filter)
                .populate('ownerId', 'name email phone')
                .populate('agentId', 'name email phone')
                .populate('locationId', 'name')
                .populate('subLocationId', 'name')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Boat.countDocuments(filter)
        ]);

        return {
            boats,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    static async createBoat(data, userId) {
        // ✅ Validate that owner exists
        if (!data.ownerId) {
            throw new Error('Owner ID is required');
        }

        const owner = await User.findById(data.ownerId);
        if (!owner) {
            throw new Error('Boat owner not found');
        }

        // ✅ If owner is not BOAT_OWNER, update their role
        if (owner.role !== 'BOAT_OWNER') {
            owner.role = 'BOAT_OWNER';
            await owner.save();
        }

        // ✅ Check if boat number already exists
        const existingBoat = await Boat.findOne({
            boatNumber: data.boatNumber,
            isDeleted: false
        });
        if (existingBoat) {
            throw new Error(`Boat with number ${data.boatNumber} already exists`);
        }

        const boat = new Boat({
            ...data,
            createdBy: userId,
            updatedBy: userId
        });
        await boat.save();
        return boat.populate(['ownerId', 'agentId', 'locationId', 'subLocationId']);
    }

    static async getBoatById(id) {
        const boat = await Boat.findById(id)
            .populate('ownerId', 'name email phone')
            .populate('agentId', 'name email phone')
            .populate('locationId', 'name')
            .populate('subLocationId', 'name')
            .lean();

        if (!boat) {
            throw new Error('Boat not found');
        }

        return boat;
    }

    static async updateBoat(id, data, userId) {
        // ✅ Check if boat exists
        const existingBoat = await Boat.findById(id);
        if (!existingBoat) {
            throw new Error('Boat not found');
        }

        // ✅ If boat number is being changed, check for duplicates
        if (data.boatNumber && data.boatNumber !== existingBoat.boatNumber) {
            const duplicate = await Boat.findOne({
                boatNumber: data.boatNumber,
                isDeleted: false,
                _id: { $ne: id }
            });
            if (duplicate) {
                throw new Error(`Boat with number ${data.boatNumber} already exists`);
            }
        }

        const boat = await Boat.findByIdAndUpdate(
            id,
            {
                ...data,
                updatedBy: userId
            },
            { new: true, runValidators: true }
        );
        return boat.populate(['ownerId', 'agentId', 'locationId', 'subLocationId']);
    }

    static async deleteBoat(id, userId) {
        // ✅ Check if boat exists
        const boat = await Boat.findById(id);
        if (!boat) {
            throw new Error('Boat not found');
        }

        // ✅ Check if boat has active bookings
        const Booking = require('../models/bookingmodel');
        const activeBooking = await Booking.findOne({
            boatId: id,
            isDeleted: false
        });

        if (activeBooking) {
            throw new Error('Cannot delete boat with active bookings');
        }

        return Boat.findByIdAndUpdate(
            id,
            {
                isDeleted: true,
                updatedBy: userId
            },
            { new: true }
        );
    }

    // ✅ Check if user has access to a boat
    static async checkBoatAccess(boat, userId, userRole) {
        if (!boat) return false;

        // SUPER_ADMIN has access to everything
        if (userRole === 'SUPER_ADMIN') return true;

        // BOAT_OWNER can access their own boats
        if (userRole === 'BOAT_OWNER') {
            // Handle both populated and unpopulated ownerId
            const ownerId = boat.ownerId?._id?.toString() || boat.ownerId?.toString();
            return ownerId === userId.toString();
        }

        // COMMISSION_AGENT can access boats under them
        if (userRole === 'COMMISSION_AGENT') {
            const agentId = boat.agentId?._id?.toString() || boat.agentId?.toString();
            return agentId === userId.toString();
        }

        // STAFF can access boats under their agent
        if (userRole === 'STAFF') {
            const user = await User.findById(userId).select('agentId').lean();
            if (user && user.agentId) {
                const agentId = boat.agentId?._id?.toString() || boat.agentId?.toString();
                return agentId === user.agentId.toString();
            }
        }

        return false;
    }

    // ✅ Get boat owners for dropdown
    static async getBoatOwners() {
        return User.find({
            role: 'BOAT_OWNER',
            isActive: true,
            isDeleted: false
        }).select('_id name email phone').lean();
    }

    // ✅ Get boats by owner (for BOAT_OWNER dashboard)
    static async getBoatsByOwner(ownerId) {
        const boats = await Boat.find({
            ownerId: ownerId,
            isDeleted: false
        })
            .populate('ownerId', 'name email phone')
            .populate('agentId', 'name email phone')
            .populate('locationId', 'name')
            .populate('subLocationId', 'name')
            .sort({ createdAt: -1 })
            .lean();

        return boats;
    }

    // ✅ Get boats with their statistics (for BOAT_OWNER dashboard)
    static async getBoatsWithStats(ownerId) {
        const boats = await this.getBoatsByOwner(ownerId);

        // Get statistics for each boat
        const Bill = require('../models/billmodel');
        const boatsWithStats = await Promise.all(boats.map(async (boat) => {
            const stats = await Bill.aggregate([
                {
                    $match: {
                        boatId: boat._id,
                        isDeleted: false,
                        status: { $ne: 'CANCELLED' }
                    }
                },
                {
                    $group: {
                        _id: '$boatId',
                        totalRevenue: { $sum: '$netAmount' },
                        totalBills: { $sum: 1 },
                        totalWeight: { $sum: '$totalWeight' }
                    }
                }
            ]);

            const stat = stats.length > 0 ? stats[0] : { totalRevenue: 0, totalBills: 0, totalWeight: 0 };

            return {
                ...boat,
                totalRevenue: stat.totalRevenue || 0,
                totalBills: stat.totalBills || 0,
                totalWeight: stat.totalWeight || 0,
                isActive: boat.isActive
            };
        }));

        return boatsWithStats;
    }

    // ✅ Toggle boat status (Active/Inactive)
    static async toggleBoatStatus(id, userId) {
        const boat = await Boat.findById(id);
        if (!boat) {
            throw new Error('Boat not found');
        }

        boat.isActive = !boat.isActive;
        boat.updatedBy = userId;
        await boat.save();

        return boat.populate(['ownerId', 'agentId', 'locationId', 'subLocationId']);
    }

    // ✅ Get boat count for a specific owner
    static async getBoatCount(ownerId) {
        return Boat.countDocuments({
            ownerId: ownerId,
            isDeleted: false
        });
    }
}

module.exports = BoatService;