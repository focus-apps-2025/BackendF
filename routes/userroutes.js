const express = require('express');
const router = express.Router();
const userController = require('../controllers/usercontroller');
const { authenticate } = require('../middleware/authmiddleware');
const { authorize } = require('../middleware/rbacmiddleware');
const { validate } = require('../middleware/validatemiddleware');
const { auditLog } = require('../middleware/auditLogmiddleware');
const {
    createUserSchema,
    updateUserSchema,
    userIdSchema,
    userListQuerySchema,
    createStaffSchema,
    updateStaffSchema
} = require('../validations/uservalidation');

// All user routes require authentication
router.use(authenticate);

// ✅ FIX: Add FISH_BUYER to the allowed roles
router.get('/commission-agents',
    authorize('SUPER_ADMIN', 'COMMISSION_AGENT', 'FISH_BUYER', 'STAFF'),  // ✅ Added FISH_BUYER
    userController.getCommissionAgents
);

// Super admin only routes
router.get('/',
    authorize('SUPER_ADMIN'),
    validate(userListQuerySchema, 'query'),
    userController.getUsers
);

router.post('/',
    authorize('SUPER_ADMIN'),
    validate(createUserSchema),
    auditLog,
    userController.createUser
);

router.get('/by-agent/:agentId',
    authorize('COMMISSION_AGENT', 'SUPER_ADMIN'),
    userController.getUsersByAgent
);

router.get('/my-staff',
    authorize('COMMISSION_AGENT'),
    userController.getMyStaff
);

router.post('/my-staff',
    authorize('COMMISSION_AGENT'),
    validate(createStaffSchema),
    userController.createMyStaff
);

router.put('/my-staff/:id',
    authorize('COMMISSION_AGENT'),
    validate(userIdSchema, 'params'),
    validate(updateStaffSchema),
    userController.updateMyStaff
);

router.delete('/my-staff/:id',
    authorize('COMMISSION_AGENT'),
    validate(userIdSchema, 'params'),
    userController.deleteMyStaff
);

router.get('/:id',
    authorize('SUPER_ADMIN', 'COMMISSION_AGENT'),
    validate(userIdSchema, 'params'),
    userController.getUserById
);

router.put('/:id',
    authorize('SUPER_ADMIN'),
    validate(userIdSchema, 'params'),
    validate(updateUserSchema),
    auditLog,
    userController.updateUser
);

router.delete('/:id',
    authorize('SUPER_ADMIN'),
    validate(userIdSchema, 'params'),
    auditLog,
    userController.deleteUser
);

router.patch('/:id/toggle-status',
    authorize('SUPER_ADMIN', 'COMMISSION_AGENT'),
    validate(userIdSchema, 'params'),
    auditLog,
    userController.toggleUserStatus
);

module.exports = router;