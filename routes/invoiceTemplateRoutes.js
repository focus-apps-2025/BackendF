// routes/invoiceTemplateRoutes.js
const express = require('express');
const router = express.Router();
const invoiceTemplateController = require('../controllers/invoiceTemplateController');
const { authenticate, authorize } = require('../middleware/authmiddleware');

// All routes require authentication
router.use(authenticate);

// Super Admin only routes
router.post('/templates',
    authorize(['SUPER_ADMIN']),
    invoiceTemplateController.createOrUpdateTemplate
);

router.get('/templates/all',
    invoiceTemplateController.getAllTemplates
);

router.delete('/templates/:id',
    authorize(['SUPER_ADMIN']),
    invoiceTemplateController.deleteTemplate
);

router.patch('/templates/:id/toggle',
    authorize(['SUPER_ADMIN']),
    invoiceTemplateController.toggleTemplateStatus
);

// Public route (any authenticated user)
router.get('/templates/active',
    invoiceTemplateController.getActiveTemplate
);

module.exports = router;