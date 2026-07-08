const express = require('express');
const router = express.Router();
const boatController = require('../controllers/boatcontroller');
const { authenticate } = require('../middleware/authmiddleware');
const { authorize } = require('../middleware/rbacmiddleware');
const { validate } = require('../middleware/validatemiddleware');
const { auditLog } = require('../middleware/auditLogmiddleware');
const {
    createBoatSchema,
    updateBoatSchema,
    boatIdSchema,
    boatListQuerySchema
} = require('../validations/boatvalidation');

// All boat routes require authentication
router.use(authenticate);

router.get('/',
    validate(boatListQuerySchema, 'query'),
    boatController.getBoats
);

router.post('/',
    authorize('COMMISSION_AGENT', 'SUPER_ADMIN'),
    validate(createBoatSchema),
    auditLog,
    boatController.createBoat
);

router.get('/owner/:ownerId',
    authorize('BOAT_OWNER', 'COMMISSION_AGENT', 'SUPER_ADMIN'),
    boatController.getBoatsByOwner
);

router.get('/agent/:agentId',
    authorize('COMMISSION_AGENT', 'SUPER_ADMIN', 'STAFF'),
    boatController.getBoatsByAgent
);

router.get('/:id',
    validate(boatIdSchema, 'params'),
    boatController.getBoatById
);

router.put('/:id',
    authorize('COMMISSION_AGENT', 'SUPER_ADMIN'),
    validate(boatIdSchema, 'params'),
    validate(updateBoatSchema),
    auditLog,
    boatController.updateBoat
);

router.delete('/:id',
    authorize('COMMISSION_AGENT', 'SUPER_ADMIN'),
    validate(boatIdSchema, 'params'),
    auditLog,
    boatController.deleteBoat
);

module.exports = router;