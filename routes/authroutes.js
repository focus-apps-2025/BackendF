const express = require('express');
const router = express.Router();
const authController = require('../controllers/authcontroller');
const { authenticate } = require('../middleware/authmiddleware');
const { validate } = require('../middleware/validatemiddleware');
const { authLimiter } = require('../middleware/rateLimiter');
const {
    loginSchema,
    refreshTokenSchema,
    changePasswordSchema
} = require('../validations/authvalidation');

// Public routes with rate limiting
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', validate(refreshTokenSchema), authController.refresh);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);
router.get('/profile', authenticate, authController.getProfile);

module.exports = router;