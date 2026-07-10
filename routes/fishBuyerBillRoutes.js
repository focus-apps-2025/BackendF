const express = require('express');
const router = express.Router();
const fishBuyerBillController = require('../controllers/fishBuyerBillController');
const { authenticate } = require('../middleware/authmiddleware');
const { authorize } = require('../middleware/rbacmiddleware');

// All routes require authentication
router.use(authenticate);

// Create bill - FISH_BUYER can create
router.post('/',
    authorize('FISH_BUYER', 'SUPER_ADMIN'),
    fishBuyerBillController.createBill
);

// Get bills (role-filtered in service)
router.get('/',
    fishBuyerBillController.getBills
);

// Get bills by agent (for agent dashboard)
router.get('/agent/:agentId',
    authorize('COMMISSION_AGENT', 'SUPER_ADMIN'),
    fishBuyerBillController.getBillsByAgent
);

// Get bill by ID
router.get('/:id',
    fishBuyerBillController.getBillById
);

// Cancel bill
router.put('/:id/cancel',
    authorize('FISH_BUYER', 'SUPER_ADMIN'),
    fishBuyerBillController.cancelBill
);

// Delete bill
router.delete('/:id',
    authorize('FISH_BUYER', 'SUPER_ADMIN'),
    fishBuyerBillController.deleteBill
);

module.exports = router;