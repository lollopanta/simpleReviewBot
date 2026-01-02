const UserCooldown = require('../models/UserCooldown');
const { getGuildSettings } = require('./guildSettings');

/**
 * Utility functions for cooldown management
 */

/**
 * Checks if a user can request a review (cooldown check)
 */
async function canRequestReview(userId, guildId) {
    const settings = await getGuildSettings(guildId);
    
    if (!settings.features.enableCooldowns) return { allowed: true };
    
    const cooldown = await UserCooldown.getOrCreate(userId, guildId);
    const canRequest = cooldown.canRequestReview(settings.cooldowns.reviewRequest);
    
    if (!canRequest) {
        const remaining = cooldown.getRequestCooldownRemaining(settings.cooldowns.reviewRequest);
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        
        return {
            allowed: false,
            remaining: remaining,
            formatted: `${hours}h ${minutes}m`
        };
    }
    
    return { allowed: true };
}

/**
 * Records a review request for cooldown tracking
 */
async function recordReviewRequest(userId, guildId) {
    const settings = await getGuildSettings(guildId);
    
    if (!settings.features.enableCooldowns) return;
    
    const cooldown = await UserCooldown.getOrCreate(userId, guildId);
    cooldown.lastReviewRequest = new Date();
    await cooldown.save();
}

/**
 * Checks if a user can submit a review (cooldown check)
 */
async function canSubmitReview(userId, guildId) {
    const settings = await getGuildSettings(guildId);
    
    if (!settings.features.enableCooldowns) return { allowed: true };
    
    const cooldown = await UserCooldown.getOrCreate(userId, guildId);
    const canSubmit = cooldown.canSubmitReview(settings.cooldowns.reviewSubmission);
    
    if (!canSubmit) {
        const remaining = settings.cooldowns.reviewSubmission - (Date.now() - cooldown.lastReviewSubmission.getTime());
        const minutes = Math.floor(remaining / (1000 * 60));
        
        return {
            allowed: false,
            remaining: remaining,
            formatted: `${minutes}m`
        };
    }
    
    return { allowed: true };
}

/**
 * Records a review submission for cooldown tracking
 */
async function recordReviewSubmission(userId, guildId) {
    const settings = await getGuildSettings(guildId);
    
    if (!settings.features.enableCooldowns) return;
    
    const cooldown = await UserCooldown.getOrCreate(userId, guildId);
    cooldown.lastReviewSubmission = new Date();
    await cooldown.save();
}

module.exports = {
    canRequestReview,
    recordReviewRequest,
    canSubmitReview,
    recordReviewSubmission
};
