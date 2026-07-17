// services/invoiceTemplateService.js
const InvoiceTemplate = require('../models/invoiceTemplateModel');
const logger = require('../config/logger');

class InvoiceTemplateService {
    /**
     * Create or update invoice template
     */
    async createOrUpdateTemplate(data, userId) {
        // Check if template exists
        let template = await InvoiceTemplate.findOne({
            isDeleted: false
        });

        if (template) {
            // Update existing template
            Object.keys(data).forEach(key => {
                if (key === 'contactDetails' || key === 'address') {
                    // Deep merge for nested objects
                    template[key] = {
                        ...template[key],
                        ...data[key]
                    };
                } else {
                    template[key] = data[key];
                }
            });
            template.updatedBy = userId;
            template.lastUpdatedAt = new Date();
        } else {
            // Create new template
            template = new InvoiceTemplate({
                ...data,
                createdBy: userId,
                updatedBy: userId,
                isActive: true
            });
        }

        await template.save();
        logger.info(`Invoice template ${template._id ? 'updated' : 'created'} by user ${userId}`);
        return template;
    }

    /**
     * Get active template
     */
    async getActiveTemplate() {
        const template = await InvoiceTemplate.getActiveTemplate();
        if (!template) {
            // Return default template if none exists
            return this.getDefaultTemplate();
        }
        return template;
    }

    /**
     * Get default template with title and subtitle
     */
    getDefaultTemplate() {
        return {
            title: 'INVOICE',
            subtitle: 'Fish Market - Official Receipt',  // ✅ NEW
            termsConditions: '1. Goods once sold will not be taken back.\n2. Payment must be made within 7 days.\n3. All disputes subject to local jurisdiction.',
            contactDetails: {
                phone: '+91 9876543210',
                email: 'contact@fishmarket.com',
                website: 'www.fishmarket.com'
            },
            address: {
                street: '123, Fish Market Road',
                city: 'Mumbai',
                state: 'Maharashtra',
                pincode: '400001',
                country: 'India'
            },
            footer: 'Thank you for your business!'
        };
    }


    /**
     * Get all templates (Super Admin only)
     */
    async getAllTemplates() {
        return InvoiceTemplate.find({ isDeleted: false })
            .sort({ updatedAt: -1 })
            .populate('createdBy', 'name email')
            .populate('updatedBy', 'name email')
            .lean();
    }

    /**
     * Delete template (soft delete)
     */
    async deleteTemplate(templateId) {
        const template = await InvoiceTemplate.findById(templateId);
        if (!template) {
            throw new Error('Template not found');
        }

        // Prevent deleting the only active template
        const activeCount = await InvoiceTemplate.countDocuments({
            isActive: true,
            isDeleted: false
        });

        if (activeCount <= 1 && template.isActive) {
            throw new Error('Cannot delete the only active template. Create a new one first.');
        }

        template.isDeleted = true;
        template.isActive = false;
        await template.save();

        logger.info(`Template deleted: ${templateId}`);
        return template;
    }

    /**
     * Toggle template active status
     */
    async toggleTemplateStatus(templateId) {
        const template = await InvoiceTemplate.findById(templateId);
        if (!template) {
            throw new Error('Template not found');
        }

        template.isActive = !template.isActive;

        // If activating this template, deactivate others
        if (template.isActive) {
            await InvoiceTemplate.updateMany(
                { _id: { $ne: templateId }, isActive: true },
                { isActive: false }
            );
        }

        await template.save();
        logger.info(`Template status toggled: ${templateId} -> ${template.isActive}`);
        return template;
    }
}

module.exports = new InvoiceTemplateService();