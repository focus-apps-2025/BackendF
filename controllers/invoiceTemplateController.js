// controllers/invoiceTemplateController.js
const invoiceTemplateService = require('../services/invoiceTemplateService');
const { successResponse, errorResponse } = require('../utils/responseutils');
const logger = require('../config/logger');

/**
 * Create or update invoice template (Super Admin only)
 */
const createOrUpdateTemplate = async (req, res, next) => {
    try {
        // Only SUPER_ADMIN can manage templates
        if (req.user.role !== 'SUPER_ADMIN') {
            return errorResponse(res, 403, 'Access denied. Only Super Admin can manage invoice templates');
        }

        const template = await invoiceTemplateService.createOrUpdateTemplate(
            req.body,
            req.user._id
        );
        successResponse(res, 200, 'Invoice template saved successfully', template);
    } catch (error) {
        logger.error('Create/Update template error:', error);
        errorResponse(res, 400, error.message || 'Failed to save invoice template');
    }
};

/**
 * Get active invoice template
 */
const getActiveTemplate = async (req, res, next) => {
    try {
        const template = await invoiceTemplateService.getActiveTemplate();
        successResponse(res, 200, 'Invoice template retrieved successfully', template);
    } catch (error) {
        logger.error('Get active template error:', error);
        errorResponse(res, 404, error.message || 'No active template found');
    }
};

/**
 * Get all templates (Super Admin only)
 */
const getAllTemplates = async (req, res, next) => {
    try {
        if (req.user.role !== 'SUPER_ADMIN') {
            return errorResponse(res, 403, 'Access denied');
        }
        const templates = await invoiceTemplateService.getAllTemplates();
        successResponse(res, 200, 'Templates retrieved successfully', templates);
    } catch (error) {
        logger.error('Get all templates error:', error);
        errorResponse(res, 500, error.message || 'Failed to get templates');
    }
};

/**
 * Delete template (Super Admin only)
 */
const deleteTemplate = async (req, res, next) => {
    try {
        if (req.user.role !== 'SUPER_ADMIN') {
            return errorResponse(res, 403, 'Access denied');
        }
        await invoiceTemplateService.deleteTemplate(req.params.id);
        successResponse(res, 200, 'Template deleted successfully');
    } catch (error) {
        logger.error('Delete template error:', error);
        errorResponse(res, 400, error.message || 'Failed to delete template');
    }
};

/**
 * Toggle template active status (Super Admin only)
 */
const toggleTemplateStatus = async (req, res, next) => {
    try {
        if (req.user.role !== 'SUPER_ADMIN') {
            return errorResponse(res, 403, 'Access denied');
        }
        const template = await invoiceTemplateService.toggleTemplateStatus(req.params.id);
        successResponse(res, 200, 'Template status updated successfully', template);
    } catch (error) {
        logger.error('Toggle template status error:', error);
        errorResponse(res, 400, error.message || 'Failed to update template status');
    }
};

module.exports = {
    createOrUpdateTemplate,
    getActiveTemplate,
    getAllTemplates,
    deleteTemplate,
    toggleTemplateStatus
};