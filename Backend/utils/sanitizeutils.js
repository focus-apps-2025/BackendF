/**
 * Sanitize string input
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
const sanitizeString = (str) => {
    if (!str) return '';
    return String(str)
        .trim()
        .replace(/[<>]/g, '') // Remove < and > to prevent XSS
        .replace(/\s+/g, ' '); // Replace multiple spaces with single space
};

/**
 * Sanitize email
 * @param {string} email - Email to sanitize
 * @returns {string} Sanitized email
 */
const sanitizeEmail = (email) => {
    if (!email) return '';
    return email.trim().toLowerCase();
};

/**
 * Sanitize phone number
 * @param {string} phone - Phone number to sanitize
 * @returns {string} Sanitized phone number
 */
const sanitizePhone = (phone) => {
    if (!phone) return '';
    return phone.replace(/[^0-9]/g, '');
};

/**
 * Sanitize object recursively
 * @param {Object} obj - Object to sanitize
 * @param {Array} fields - Fields to sanitize
 * @returns {Object} Sanitized object
 */
const sanitizeObject = (obj, fields = []) => {
    if (!obj || typeof obj !== 'object') return obj;

    const result = { ...obj };

    fields.forEach(field => {
        if (result[field] !== undefined && typeof result[field] === 'string') {
            result[field] = sanitizeString(result[field]);
        }
    });

    return result;
};

/**
 * Escape special characters for MongoDB
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
const escapeMongoRegex = (str) => {
    if (!str) return '';
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

module.exports = {
    sanitizeString,
    sanitizeEmail,
    sanitizePhone,
    sanitizeObject,
    escapeMongoRegex
};