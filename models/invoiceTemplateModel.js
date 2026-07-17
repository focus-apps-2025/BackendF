// models/invoiceTemplateModel.js
const mongoose = require('mongoose');

const invoiceTemplateSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        default: 'INVOICE'
    },
    subtitle: {
        type: String,
        trim: true,
        default: 'Fish Market - Official Receipt'
    },
    termsConditions: {
        type: String,
        required: true,
        trim: true,
        default: '1. Goods once sold will not be taken back.\n2. Payment must be made within 7 days.\n3. All disputes subject to local jurisdiction.'
    },
    contactDetails: {
        phone: {
            type: String,
            required: true,
            trim: true,
            default: '+91 9876543210'
        },
        email: {
            type: String,
            trim: true,
            lowercase: true,
            default: 'contact@fishmarket.com'
        },
        website: {
            type: String,
            trim: true,
            default: 'www.fishmarket.com'
        }
    },
    address: {
        street: {
            type: String,
            required: true,
            trim: true,
            default: '123, Fish Market Road'
        },
        city: {
            type: String,
            required: true,
            trim: true,
            default: 'Mumbai'
        },
        state: {
            type: String,
            required: true,
            trim: true,
            default: 'Maharashtra'
        },
        pincode: {
            type: String,
            required: true,
            trim: true,
            default: '400001'
        },
        country: {
            type: String,
            required: true,
            trim: true,
            default: 'India'
        }
    },
    footer: {
        type: String,
        trim: true,
        default: 'Thank you for your business!'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    lastUpdatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes
invoiceTemplateSchema.index({ isActive: 1, isDeleted: 1 });
invoiceTemplateSchema.index({ createdBy: 1 });
invoiceTemplateSchema.index({ updatedAt: -1 });

// ✅ FIXED: Pre-save middleware - NO 'next' parameter
invoiceTemplateSchema.pre('save', function () {
    this.lastUpdatedAt = new Date();
    // Don't call next() - just return or use async/await
});

// OR using async/await:
// invoiceTemplateSchema.pre('save', async function() {
//     this.lastUpdatedAt = new Date();
// });

// Static method to get active template
invoiceTemplateSchema.statics.getActiveTemplate = function () {
    return this.findOne({
        isActive: true,
        isDeleted: false
    }).lean();
};

// Instance method to get formatted address
invoiceTemplateSchema.methods.getFormattedAddress = function () {
    const addr = this.address;
    return `${addr.street}, ${addr.city}, ${addr.state} - ${addr.pincode}, ${addr.country}`;
};

// Instance method to get formatted contact
invoiceTemplateSchema.methods.getFormattedContact = function () {
    const contact = this.contactDetails;
    let formatted = `Phone: ${contact.phone}`;
    if (contact.email) formatted += ` | Email: ${contact.email}`;
    if (contact.website) formatted += ` | Web: ${contact.website}`;
    return formatted;
};

const InvoiceTemplate = mongoose.model('InvoiceTemplate', invoiceTemplateSchema);
module.exports = InvoiceTemplate;