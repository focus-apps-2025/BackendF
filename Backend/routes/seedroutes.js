const express = require('express');
const router = express.Router();
const seedController = require('../controllers/seedcontroller');

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

router.post('/superadmin', asyncHandler(seedController.seedSuperAdmin));

module.exports = router;
