const mongoose = require('mongoose');

/**
 * Review Schema
 * Stores submitted reviews after staff approval
 */
const reviewSchema = new mongoose.Schema({
    // Discord Guild ID
    guildId: {
        type: String,
        required: true,
        index: true
    },
    
    // Product ID this review is for
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
        index: true
    },
    
    // User who submitted the review
    userId: {
        type: String,
        required: true,
        index: true
    },
    
    // Username at the time of submission (for historical reference)
    reviewerUsername: {
        type: String,
        required: true
    },
    
    // Review text content
    reviewText: {
        type: String,
        required: true,
        minlength: 10,
        maxlength: 2000
    },
    
    // Rating (1-5 stars)
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
        index: true
    },
    
    // Timestamp when review was submitted
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    
    // Staff member who approved the review request
    staffApproverId: {
        type: String,
        required: true
    },
    
    // Status of the review
    status: {
        type: String,
        enum: ['pending', 'approved', 'denied', 'deleted'],
        default: 'approved',
        index: true
    },
    
    // Discord message ID where the review was posted
    messageId: {
        type: String,
        default: null
    },
    
    // Discord channel ID where the review was posted
    channelId: {
        type: String,
        default: null
    },
    
    // Whether the review is anonymous
    anonymous: {
        type: Boolean,
        default: false
    },
    
    // Staff member who last edited the review (if applicable)
    lastEditedBy: {
        type: String,
        default: null
    },
    
    // Timestamp of last edit
    lastEditedAt: {
        type: Date,
        default: null
    },
    
    // Soft delete timestamp
    deletedAt: {
        type: Date,
        default: null,
        index: true
    }
}, {
    timestamps: true // Adds createdAt and updatedAt automatically
});

// Index for efficient queries
reviewSchema.index({ guildId: 1, status: 1, timestamp: -1 });
reviewSchema.index({ guildId: 1, productId: 1, status: 1 });
reviewSchema.index({ userId: 1, guildId: 1, timestamp: -1 });
reviewSchema.index({ status: 1, deletedAt: 1 });

/**
 * Static method to calculate average rating for a user in a guild
 */
reviewSchema.statics.getAverageRating = async function(userId, guildId) {
    const result = await this.aggregate([
        {
            $match: {
                userId: userId,
                guildId: guildId,
                status: 'approved',
                deletedAt: null
            }
        },
        {
            $group: {
                _id: null,
                averageRating: { $avg: '$rating' },
                totalReviews: { $sum: 1 }
            }
        }
    ]);
    
    if (result.length === 0) {
        return { averageRating: 0, totalReviews: 0 };
    }
    
    return {
        averageRating: Math.round(result[0].averageRating * 10) / 10, // Round to 1 decimal
        totalReviews: result[0].totalReviews
    };
};

/**
 * Static method to get all reviews for a user in a guild
 */
reviewSchema.statics.getUserReviews = async function(userId, guildId, limit = 10) {
    return await this.find({
        userId: userId,
        guildId: guildId,
        status: 'approved',
        deletedAt: null
    })
    .populate('productId', 'name price')
    .sort({ timestamp: -1 })
    .limit(limit);
};

/**
 * Static method to get reviews for a product
 */
reviewSchema.statics.getProductReviews = async function(productId, limit = 20) {
    return await this.find({
        productId: productId,
        status: 'approved',
        deletedAt: null
    })
    .sort({ timestamp: -1 })
    .limit(limit);
};

/**
 * Static method to get guild statistics
 */
reviewSchema.statics.getGuildStats = async function(guildId) {
    const result = await this.aggregate([
        {
            $match: {
                guildId: guildId,
                deletedAt: null
            }
        },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                avgRating: { $avg: '$rating' }
            }
        }
    ]);
    
    const stats = {
        total: 0,
        approved: 0,
        pending: 0,
        denied: 0,
        averageRating: 0
    };
    
    result.forEach(item => {
        stats.total += item.count;
        if (item._id === 'approved') {
            stats.approved = item.count;
            stats.averageRating = Math.round(item.avgRating * 10) / 10;
        } else if (item._id === 'pending') {
            stats.pending = item.count;
        } else if (item._id === 'denied') {
            stats.denied = item.count;
        }
    });
    
    return stats;
};

module.exports = mongoose.model('Review', reviewSchema);
