/**
 * Generate unique bill number
 * Format: BILL-YYYYMMDD-XXXX
 * @param {Date} date - Bill date
 * @param {number} sequence - Sequence number
 * @returns {string} Bill number
 */
const generateBillNumber = (date = new Date(), sequence = 1) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const seq = String(sequence).padStart(4, '0');

    return `BILL-${year}${month}${day}-${seq}`;
};

/**
 * Generate random string
 * @param {number} length - Length of string
 * @param {string} chars - Characters to use
 * @returns {string} Random string
 */
const generateRandomString = (length = 8, chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') => {
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

/**
 * Generate unique ID with prefix
 * @param {string} prefix - ID prefix
 * @param {number} sequence - Sequence number
 * @param {number} padLength - Pad length
 * @returns {string} Generated ID
 */
const generateId = (prefix = '', sequence = 1, padLength = 6) => {
    const seq = String(sequence).padStart(padLength, '0');
    return prefix ? `${prefix}-${seq}` : seq;
};

module.exports = {
    generateBillNumber,
    generateRandomString,
    generateId
};