const express = require('express');
const router = express.Router();
const locationController = require('../controllers/locationcontroller');
const { authenticate } = require('../middleware/authmiddleware');
const { authorize } = require('../middleware/rbacmiddleware');
const { validate } = require('../middleware/validatemiddleware');
const { auditLog } = require('../middleware/auditLogmiddleware');
const {
    createLocationSchema,
    updateLocationSchema,
    locationIdSchema,
    createSubLocationSchema,
    updateSubLocationSchema,
    subLocationIdSchema
} = require('../validations/locationvalidation');

// All location routes require authentication
router.use(authenticate);

// Location routes
router.get('/', locationController.getLocations);

router.post('/',
    authorize('SUPER_ADMIN'),
    validate(createLocationSchema),
    auditLog,
    locationController.createLocation
);

router.get('/:id',
    validate(locationIdSchema, 'params'),
    locationController.getLocationById
);

router.put('/:id',
    authorize('SUPER_ADMIN'),
    validate(locationIdSchema, 'params'),
    validate(updateLocationSchema),
    auditLog,
    locationController.updateLocation
);

router.delete('/:id',
    authorize('SUPER_ADMIN'),
    validate(locationIdSchema, 'params'),
    auditLog,
    locationController.deleteLocation
);

// Sub-location routes
router.post('/:id/sub',
    authorize('SUPER_ADMIN'),
    validate(locationIdSchema, 'params'),
    validate(createSubLocationSchema),
    auditLog,
    locationController.createSubLocation
);

router.put('/:id/sub/:subId',
    authorize('SUPER_ADMIN'),
    validate(locationIdSchema, 'params'),
    validate(subLocationIdSchema, 'params'),
    validate(updateSubLocationSchema),
    auditLog,
    locationController.updateSubLocation
);

router.delete('/:id/sub/:subId',
    authorize('SUPER_ADMIN'),
    validate(locationIdSchema, 'params'),
    validate(subLocationIdSchema, 'params'),
    auditLog,
    locationController.deleteSubLocation
);

module.exports = router;