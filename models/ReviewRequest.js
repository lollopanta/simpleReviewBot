const mongoose = require('mongoose');

/**
 * Review Request Schema
 * Stores pending review requests awaiting staff approval
 */
const reviewRequestSchema = new mongoose.Schema({
    // Discord Guild ID
    guildId: {
        type: String,
        required: true,
        index: true
    },
    
    // User who requested to submit a review
    userId: {
        type: String,
        required: true,
        index: true
    },
    
    // Username at the time of request
    requesterUsername: {
        type: String,
        required: true
    },
    
    // Discord message ID of the request panel in staff channel
    requestMessageId: {
        type: String,
        required: true,
        unique: true
    },
    
    // Discord channel ID where the request was posted
    requestChannelId: {
        type: String,
        required: true
    },
    
    // Product ID (set when approved by staff)
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        default: null
    },
    
    // Status of the request
    status: {
        type: String,
        enum: ['pending', 'approved', 'denied'],
        default: 'pending',
        index: true
    },
    
    // Staff member who approved/denied the request
    staffMemberId: {
        type: String,
        default: null
    },
    
    // Internal note from staff (optional)
    staffNote: {
        type: String,
        default: null,
        maxlength: 500
    },
    
    // Timestamp when request was created
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    
    // Timestamp when request was approved/denied
    processedAt: {
        type: Date,
        default: null
    },
    
    // Reason for denial (if denied)
    denialReason: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

// Index for efficient queries
reviewRequestSchema.index({ guildId: 1, status: 1, createdAt: -1 });
reviewRequestSchema.index({ userId: 1, guildId: 1, status: 1 });

/**
 * Static method to check if user has an active pending request in a guild
 */
reviewRequestSchema.statics.hasActiveRequest = async function(userId, guildId) {
    const activeRequest = await this.findOne({
        userId: userId,
        guildId: guildId,
        status: 'pending'
    });
    
    return activeRequest !== null;
};

/**
 * Static method to get active request for a user in a guild
 */
reviewRequestSchema.statics.getActiveRequest = async function(userId, guildId) {
    return await this.findOne({
        userId: userId,
        guildId: guildId,
        status: 'pending'
    }).populate('productId', 'name price');
};

module.exports = mongoose.model('ReviewRequest', reviewRequestSchema);
