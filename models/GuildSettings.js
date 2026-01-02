const mongoose = require('mongoose');

/**
 * Guild Settings Schema
 * Stores per-guild configuration for the review bot
 */
const guildSettingsSchema = new mongoose.Schema({
    // Discord Guild ID
    guildId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // Channel IDs
    channels: {
        // Channel where staff review requests are posted
        staffReviewChannel: {
            type: String,
            default: null
        },
        
        // Channel where approved reviews are posted
        reviewsChannel: {
            type: String,
            default: null
        },
        
        // Channel for logging staff actions
        logsChannel: {
            type: String,
            default: null
        }
    },
    
    // Role IDs
    roles: {
        // Role ID for staff members who can approve/deny reviews
        staffRole: {
            type: String,
            default: null
        }
    },
    
    // Feature Toggles
    features: {
        // Allow anonymous reviews
        allowAnonymous: {
            type: Boolean,
            default: false
        },
        
        // Enable cooldown system
        enableCooldowns: {
            type: Boolean,
            default: true
        },
        
        // Auto-approve review requests (bypass staff approval)
        autoApproval: {
            type: Boolean,
            default: false
        },
        
        // Allow users to edit their own reviews
        allowReviewEdits: {
            type: Boolean,
            default: false
        }
    },
    
    // Cooldown Settings (in milliseconds)
    cooldowns: {
        // Cooldown between review requests
        reviewRequest: {
            type: Number,
            default: 24 * 60 * 60 * 1000 // 24 hours
        },
        
        // Cooldown between review submissions
        reviewSubmission: {
            type: Number,
            default: 60 * 60 * 1000 // 1 hour
        }
    },
    
    // Review Settings
    review: {
        // Minimum review text length
        minTextLength: {
            type: Number,
            default: 10
        },
        
        // Maximum review text length
        maxTextLength: {
            type: Number,
            default: 2000
        },
        
        // Minimum rating
        minRating: {
            type: Number,
            default: 1
        },
        
        // Maximum rating
        maxRating: {
            type: Number,
            default: 5
        },
        
        // Maximum reviews per user
        maxReviewsPerUser: {
            type: Number,
            default: null // null = unlimited
        }
    },
    
    // Default language for reviews
    defaultLanguage: {
        type: String,
        default: 'en'
    },
    
    // Last updated by (user ID)
    lastUpdatedBy: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

/**
 * Static method to get or create guild settings
 */
guildSettingsSchema.statics.getOrCreate = async function(guildId) {
    let settings = await this.findOne({ guildId });
    
    if (!settings) {
        settings = await this.create({ guildId });
    }
    
    return settings;
};

/**
 * Instance method to validate channel IDs
 */
guildSettingsSchema.methods.validateChannels = async function(client) {
    const validation = {
        staffReviewChannel: null,
        reviewsChannel: null,
        logsChannel: null,
        valid: true
    };
    
    try {
        if (this.channels.staffReviewChannel) {
            const channel = await client.channels.fetch(this.channels.staffReviewChannel).catch(() => null);
            validation.staffReviewChannel = channel !== null;
            if (!channel) validation.valid = false;
        }
        
        if (this.channels.reviewsChannel) {
            const channel = await client.channels.fetch(this.channels.reviewsChannel).catch(() => null);
            validation.reviewsChannel = channel !== null;
            if (!channel) validation.valid = false;
        }
        
        if (this.channels.logsChannel) {
            const channel = await client.channels.fetch(this.channels.logsChannel).catch(() => null);
            validation.logsChannel = channel !== null;
            if (!channel) validation.valid = false;
        }
    } catch (error) {
        validation.valid = false;
    }
    
    return validation;
};

module.exports = mongoose.model('GuildSettings', guildSettingsSchema);
