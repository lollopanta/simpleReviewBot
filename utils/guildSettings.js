const GuildSettings = require('../models/GuildSettings');

/**
 * Utility functions for guild settings management
 */

/**
 * Get guild settings (with caching in memory)
 */
const settingsCache = new Map();

async function getGuildSettings(guildId) {
    // Check cache first
    if (settingsCache.has(guildId)) {
        const cached = settingsCache.get(guildId);
        // Cache for 5 minutes
        if (Date.now() - cached.timestamp < 5 * 60 * 1000) {
            return cached.settings;
        }
    }
    
    // Fetch from database
    const settings = await GuildSettings.getOrCreate(guildId);
    
    // Update cache
    settingsCache.set(guildId, {
        settings,
        timestamp: Date.now()
    });
    
    return settings;
}

/**
 * Update guild settings
 */
async function updateGuildSettings(guildId, updates, updatedBy = null) {
    const settings = await GuildSettings.getOrCreate(guildId);
    
    // Update fields
    Object.keys(updates).forEach(key => {
        if (key === 'channels' || key === 'roles' || key === 'features' || key === 'cooldowns' || key === 'review') {
            // Nested objects
            Object.keys(updates[key]).forEach(nestedKey => {
                settings[key][nestedKey] = updates[key][nestedKey];
            });
        } else {
            settings[key] = updates[key];
        }
    });
    
    if (updatedBy) {
        settings.lastUpdatedBy = updatedBy;
    }
    
    await settings.save();
    
    // Invalidate cache
    settingsCache.delete(guildId);
    
    return settings;
}

/**
 * Clear settings cache for a guild
 */
function clearSettingsCache(guildId) {
    if (guildId) {
        settingsCache.delete(guildId);
    } else {
        settingsCache.clear();
    }
}

/**
 * Get default settings
 */
function getDefaultSettings() {
    return {
        channels: {
            staffReviewChannel: null,
            reviewsChannel: null,
            logsChannel: null
        },
        roles: {
            staffRole: null
        },
        features: {
            allowAnonymous: false,
            enableCooldowns: true,
            autoApproval: false,
            allowReviewEdits: false
        },
        cooldowns: {
            reviewRequest: 24 * 60 * 60 * 1000, // 24 hours
            reviewSubmission: 60 * 60 * 1000 // 1 hour
        },
        review: {
            minTextLength: 10,
            maxTextLength: 2000,
            minRating: 1,
            maxRating: 5,
            maxReviewsPerUser: null
        },
        defaultLanguage: 'en'
    };
}

module.exports = {
    getGuildSettings,
    updateGuildSettings,
    clearSettingsCache,
    getDefaultSettings
};
