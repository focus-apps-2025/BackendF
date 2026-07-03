const express = require('express');
const router = express.Router();
const billController = require('../controllers/billcontroller');
const { authenticate } = require('../middleware/authmiddleware');
const { authorize } = require('../middleware/rbacmiddleware');
const { validate } = require('../middleware/validatemiddleware');
const { auditLog } = require('../middleware/auditLogmiddleware');
const {
    createBillSchema,
    updateBillSchema,
    billIdSchema,
    billListQuerySchema
} = require('../validations/billvalidation');

// All bill routes require authentication
router.use(authenticate);

router.get('/',
    validate(billListQuerySchema, 'query'),
    billController.getBills
);

router.post('/',
    authorize('COMMISSION_AGENT', 'STAFF', 'SUPER_ADMIN'),
    auditLog,
    billController.createBill
);

router.get('/boat/:boatId/summary',
    authorize('BOAT_OWNER', 'COMMISSION_AGENT', 'SUPER_ADMIN'),
    billController.getBillSummaryByBoat
);

router.get('/:id',
    validate(billIdSchema, 'params'),
    billController.getBillById
);

router.put('/:id',
    authorize('COMMISSION_AGENT', 'STAFF', 'SUPER_ADMIN'),
    validate(billIdSchema, 'params'),
    validate(updateBillSchema),
    auditLog,
    billController.updateBill
);

router.delete('/:id',
    authorize('COMMISSION_AGENT', 'SUPER_ADMIN'),
    validate(billIdSchema, 'params'),
    auditLog,
    billController.deleteBill
);

module.exports = router;