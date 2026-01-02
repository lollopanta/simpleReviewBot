const mongoose = require('mongoose');

/**
 * User Cooldown Schema
 * Tracks cooldowns for users to prevent spam
 */
const userCooldownSchema = new mongoose.Schema({
    // Discord Guild ID
    guildId: {
        type: String,
        required: true,
        index: true
    },
    
    // User ID
    userId: {
        type: String,
        required: true,
        index: true
    },
    
    // Last time user requested a review
    lastReviewRequest: {
        type: Date,
        default: null
    },
    
    // Last time user submitted a review
    lastReviewSubmission: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

/**
 * Instance method to check if user can request a review
 */
userCooldownSchema.methods.canRequestReview = function(cooldownDuration) {
    if (!this.lastReviewRequest) return true;
    
    const now = new Date();
    const timeSinceLastRequest = now - this.lastReviewRequest;
    
    return timeSinceLastRequest >= cooldownDuration;
};

/**
 * Instance method to check if user can submit a review
 */
userCooldownSchema.methods.canSubmitReview = function(cooldownDuration) {
    if (!this.lastReviewSubmission) return true;
    
    const now = new Date();
    const timeSinceLastSubmission = now - this.lastReviewSubmission;
    
    return timeSinceLastSubmission >= cooldownDuration;
};

/**
 * Instance method to get time remaining until next review request
 */
userCooldownSchema.methods.getRequestCooldownRemaining = function(cooldownDuration) {
    if (!this.lastReviewRequest) return 0;
    
    const now = new Date();
    const timeSinceLastRequest = now - this.lastReviewRequest;
    const remaining = cooldownDuration - timeSinceLastRequest;
    
    return remaining > 0 ? remaining : 0;
};

// Compound unique index
userCooldownSchema.index({ guildId: 1, userId: 1 }, { unique: true });

/**
 * Static method to get or create cooldown for a user in a guild
 */
userCooldownSchema.statics.getOrCreate = async function(userId, guildId) {
    let cooldown = await this.findOne({ userId, guildId });
    
    if (!cooldown) {
        cooldown = await this.create({ userId, guildId });
    }
    
    return cooldown;
};

module.exports = mongoose.model('UserCooldown', userCooldownSchema);
