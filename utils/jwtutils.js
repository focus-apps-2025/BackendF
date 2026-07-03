const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Generate access token
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {string} Access token
 */
const generateAccessToken = (userId, role) => {
    return jwt.sign(
        { userId, role },
        env.accessTokenSecret,
        { expiresIn: env.accessTokenExpiry }
    );
};

/**
 * Generate refresh token
 * @param {string} userId - User ID
 * @param {string} role - User role
 * @returns {string} Refresh token
 */
const generateRefreshToken = (userId, role) => {
    return jwt.sign(
        { userId, role },
        env.refreshTokenSecret,
        { expiresIn: env.refreshTokenExpiry }
    );
};

/**
 * Verify refresh token
 * @param {string} token - Refresh token
 * @returns {Object} Decoded token
 */
const verifyRefreshToken = (token) => {
    return jwt.verify(token, env.refreshTokenSecret);
};

/**
 * Verify access token
 * @param {string} token - Access token
 * @returns {Object} Decoded token
 */
const verifyAccessToken = (token) => {
    return jwt.verify(token, env.accessTokenSecret);
};

/**
 * Get token expiry in milliseconds
 * @param {string} token - JWT token
 * @returns {number} Expiry time in milliseconds
 */
const getTokenExpiry = (token) => {
    const decoded = jwt.decode(token);
    return decoded ? decoded.exp * 1000 : 0;
};

/**
 * Check if token is expired
 * @param {string} token - JWT token
 * @returns {boolean} True if expired
 */
const isTokenExpired = (token) => {
    const expiry = getTokenExpiry(token);
    return expiry < Date.now();
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken,
    verifyAccessToken,
    getTokenExpiry,
    isTokenExpired
};