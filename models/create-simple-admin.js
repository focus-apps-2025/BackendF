// create-simple-admin.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

// Load environment variables from the correct path
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Verify environment variables are loaded
console.log('📧 MONGODB_URI:', process.env.MONGODB_URI ? '✅ Loaded' : '❌ Not loaded');
console.log('🔑 ACCESS_TOKEN_SECRET:', process.env.ACCESS_TOKEN_SECRET ? '✅ Loaded' : '❌ Not loaded');

async function createSimpleAdmin() {
    try {
        // Check if MONGODB_URI exists
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in .env file');
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const User = require('./usermodel');

        // Delete existing
        await User.deleteOne({ email: 'testadmin@gmail.com' });
        console.log('✅ Deleted existing user (if any)');

        // Create new admin with simple password
        const admin = new User({
            name: 'Test Admin',
            email: 'testadmin@gmail.com',
            password: 'password123',
            role: 'SUPER_ADMIN',
            isActive: true,
            isDeleted: false,
        });

        await admin.save();
        console.log('✅ Test Admin created!');
        console.log('📧 Email: testadmin@gmail.com');
        console.log('🔑 Password: password123');
        console.log('🔑 Hash saved:', admin.password);

        // Test login immediately
        const isMatch = await bcrypt.compare('password123', admin.password);
        console.log('🔐 Immediate test login:', isMatch);

        await mongoose.disconnect();
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

createSimpleAdmin();