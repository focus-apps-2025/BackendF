const express = require('express');
const router = express.Router();
const fishController = require('../controllers/fishcontroller');
const { authenticate } = require('../middleware/authmiddleware');
const { authorize } = require('../middleware/rbacmiddleware');
const { validate } = require('../middleware/validatemiddleware');
const { auditLog } = require('../middleware/auditLogmiddleware');
const {
    createFishSchema,
    updateFishSchema,
    fishIdSchema,
    fishListQuerySchema
} = require('../validations/fishvalidation');

// All fish routes require authentication
router.use(authenticate);

router.get('/',
    validate(fishListQuerySchema, 'query'),
    fishController.getFish
);

router.post('/',
    authorize('COMMISSION_AGENT', 'SUPER_ADMIN'),
    auditLog,
    fishController.createFish
);

router.get('/agent/:agentId',
    authorize('COMMISSION_AGENT', 'SUPER_ADMIN', 'STAFF'),
    fishController.getFishByAgent
);

router.get('/:id',
    validate(fishIdSchema, 'params'),
    fishController.getFishById
);

router.put('/:id',
    authorize('COMMISSION_AGENT', 'SUPER_ADMIN'),
    validate(fishIdSchema, 'params'),
    validate(updateFishSchema),
    auditLog,
    fishController.updateFish
);

router.delete('/:id',
    authorize('COMMISSION_AGENT', 'SUPER_ADMIN'),
    validate(fishIdSchema, 'params'),
    auditLog,
    fishController.deleteFish
);

module.exports = router;