const mongoose = require('mongoose');

/**
 * Product Schema
 * Stores products that reviews can be associated with
 */
const productSchema = new mongoose.Schema({
    // Discord Guild ID (products are per-guild)
    guildId: {
        type: String,
        required: true,
        index: true
    },
    
    // Product name
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    
    // Product description
    description: {
        type: String,
        default: '',
        maxlength: 500
    },
    
    // Price in EUR
    price: {
        type: Number,
        required: true,
        min: 0
    },
    
    // Number of reviews for this product
    reviewCount: {
        type: Number,
        default: 0,
        min: 0
    },
    
    // Average rating (1-5)
    averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    
    // Total rating sum (for calculating average)
    totalRatingSum: {
        type: Number,
        default: 0
    },
    
    // Created by (user ID)
    createdBy: {
        type: String,
        required: true
    },
    
    // Whether the product is active (soft delete)
    active: {
        type: Boolean,
        default: true,
        index: true
    }
}, {
    timestamps: true
});

// Compound index for efficient queries
productSchema.index({ guildId: 1, active: 1 });
productSchema.index({ guildId: 1, name: 1 });

/**
 * Instance method to update rating statistics
 */
productSchema.methods.updateRatingStats = async function() {
    const Review = mongoose.model('Review');
    
    const stats = await Review.aggregate([
        {
            $match: {
                productId: this._id.toString(),
                status: 'approved',
                deletedAt: null
            }
        },
        {
            $group: {
                _id: null,
                count: { $sum: 1 },
                avgRating: { $avg: '$rating' },
                totalSum: { $sum: '$rating' }
            }
        }
    ]);
    
    if (stats.length > 0) {
        this.reviewCount = stats[0].count;
        this.averageRating = Math.round(stats[0].avgRating * 10) / 10; // Round to 1 decimal
        this.totalRatingSum = stats[0].totalSum;
    } else {
        this.reviewCount = 0;
        this.averageRating = 0;
        this.totalRatingSum = 0;
    }
    
    await this.save();
};

/**
 * Static method to get products for a guild
 */
productSchema.statics.getGuildProducts = async function(guildId, includeInactive = false) {
    const query = { guildId };
    if (!includeInactive) {
        query.active = true;
    }
    
    return await this.find(query).sort({ name: 1 });
};

/**
 * Static method to get product by ID and guild
 */
productSchema.statics.getProduct = async function(productId, guildId) {
    return await this.findOne({
        _id: productId,
        guildId: guildId,
        active: true
    });
};

module.exports = mongoose.model('Product', productSchema);
