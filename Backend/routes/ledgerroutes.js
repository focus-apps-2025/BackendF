const express = require('express');
const router = express.Router();
const ledgerController = require('../controllers/ledgercontroller');
const { authenticate } = require('../middleware/authmiddleware');
const { authorize } = require('../middleware/rbacmiddleware');
const { validate } = require('../middleware/validatemiddleware');
const { auditLog } = require('../middleware/auditLogmiddleware');
const {
    ledgerListQuerySchema,
    createLedgerSchema
} = require('../validations/ledgervalidation');

// All ledger routes require authentication
router.use(authenticate);

// Get all boat balances
router.get('/balances',
    authorize('COMMISSION_AGENT', 'SUPER_ADMIN'),
    ledgerController.getAllBoatBalances
);

// Get ledger entries by boat
router.get('/boat/:boatId',
    authorize('COMMISSION_AGENT', 'BOAT_OWNER', 'SUPER_ADMIN'),
    validate(ledgerListQuerySchema, 'query'),
    ledgerController.getLedgerByBoat
);

// Get current balance for a boat
router.get('/boat/:boatId/balance',
    authorize('COMMISSION_AGENT', 'BOAT_OWNER', 'SUPER_ADMIN'),
    ledgerController.getCurrentBalance
);

// Get ledger summary by owner
router.get('/owner/:ownerId/summary',
    authorize('BOAT_OWNER', 'COMMISSION_AGENT', 'SUPER_ADMIN'),
    ledgerController.getLedgerSummaryByOwner
);

// Create ledger entry (internal use, super admin only)
router.post('/',
    authorize('SUPER_ADMIN'),
    validate(createLedgerSchema),
    auditLog,
    ledgerController.createLedgerEntry
);

module.exports = router;