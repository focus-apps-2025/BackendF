const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const env = require('../config/env');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 100
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: /^\S+@\S+\.\S+$/
    },
    phone: {
        type: String,
        trim: true,
        match: /^[0-9]{10}$/
    },
    password: {
        type: String,
        required: true,
        minlength: 8
    },
    role: {
        type: String,
        enum: ['SUPER_ADMIN', 'COMMISSION_AGENT', 'STAFF', 'FISH_BUYER', 'BOAT_OWNER'],
        required: true,
        default: 'FISH_BUYER'
    },
    locationId: {
        type: String,
        trim: true
    },
    subLocationId: {
        type: String,
        trim: true
    },
    agentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date
    },
    refreshTokens: [{
        token: {
            type: String,
            required: true
        },
        expiresAt: {
            type: Date,
            required: true
        }
    }]
}, {
    timestamps: true
});

// Indexes for performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ agentId: 1 });
userSchema.index({ locationId: 1 });
userSchema.index({ isActive: 1, isDeleted: 1 });

// ✅ FIXED: Pre-save middleware without 'next'
userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    try {
        const salt = await bcrypt.genSalt(env.bcryptSaltRounds || 12);
        this.password = await bcrypt.hash(this.password, salt);
        console.log('✅ Password hashed successfully');
    } catch (error) {
        console.error('❌ Password hashing failed:', error);
        throw error;
    }
});

// ✅ FIXED: Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!candidatePassword || !this.password) {
        console.log('❌ Missing password data for comparison');
        return false;
    }
    try {
        const isMatch = await bcrypt.compare(candidatePassword, this.password);
        return isMatch;
    } catch (error) {
        console.error('❌ Error comparing passwords:', error);
        return false;
    }
};

// Instance method to add refresh token
userSchema.methods.addRefreshToken = function (token, expiresAt) {
    this.refreshTokens.push({ token, expiresAt });
    return this.save();
};

// Instance method to remove refresh token
userSchema.methods.removeRefreshToken = async function (token) {
    this.refreshTokens = this.refreshTokens.filter(t => t.token !== token);
    return this.save();
};

// Instance method to clear all refresh tokens
userSchema.methods.clearRefreshTokens = async function () {
    this.refreshTokens = [];
    return this.save();
};

// Static method to find by email
userSchema.statics.findByEmail = function (email) {
    return this.findOne({ email: email.toLowerCase().trim() });
};

// To JSON transformation
userSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.password;
        delete ret.refreshTokens;
        delete ret.__v;
        return ret;
    }
});

const User = mongoose.model('User', userSchema);
module.exports = User;