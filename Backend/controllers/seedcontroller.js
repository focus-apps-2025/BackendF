const User = require('../models/usermodel');
const { hashPassword } = require('../utils/bcryptutils');
const { successResponse, errorResponse } = require('../utils/responseutils');
const logger = require('../config/logger');
const env = require('../config/env');

const seedSuperAdmin = async (req, res, next) => {
    try {
        if (env.isProduction) {
            return errorResponse(res, 403, 'Seeding is not allowed in production');
        }

        // Get seed secret from headers or query
        const seedSecret = req.headers['x-seed-secret'] || req.query.seedSecret;
        if (!seedSecret || seedSecret !== process.env.SEED_SECRET) {
            return errorResponse(res, 403, 'Invalid seed secret');
        }

        const existingSuperAdmin = await User.findOne({ role: 'SUPER_ADMIN', isDeleted: false });
        if (existingSuperAdmin) {
            return successResponse(res, 200, 'SUPER_ADMIN already exists', {
                id: existingSuperAdmin._id,
                name: existingSuperAdmin.name,
                email: existingSuperAdmin.email,
                role: existingSuperAdmin.role
            });
        }

        const email = process.env.SUPER_ADMIN_EMAIL;
        const password = process.env.SUPER_ADMIN_PASSWORD;
        const name = process.env.SUPER_ADMIN_NAME;

        if (!email || !password || !name) {
            return errorResponse(res, 500, 'Missing SUPER_ADMIN credentials in .env file');
        }

        const hashedPassword = await hashPassword(password);

        const superAdmin = new User({
            name,
            email,
            password: hashedPassword,
            role: 'SUPER_ADMIN',
            isActive: true,
            isDeleted: false
        });

        await superAdmin.save();

        logger.info(`SUPER_ADMIN seeded: ${superAdmin.email}`);

        return successResponse(res, 201, 'SUPER_ADMIN created successfully', {
            id: superAdmin._id,
            name: superAdmin.name,
            email: superAdmin.email,
            role: superAdmin.role
        });
    } catch (error) {
        logger.error('Seed superadmin error:', error);
        return errorResponse(res, 500, error.message || 'Failed to seed superadmin');
    }
};

module.exports = {
    seedSuperAdmin
};
