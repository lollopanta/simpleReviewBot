/**
 * Bot Configuration File
 * Contains all configurable settings for the review bot
 */

module.exports = {
    // Discord Bot Token (set in .env)
    // token: process.env.BOT_TOKEN,

    // MongoDB Connection URI (set in .env)
    // mongoURI: process.env.MONGODB_URI,

    // Channel IDs
    channels: {
        // Channel where staff review requests are posted
        staffReviewChannel: process.env.STAFF_REVIEW_CHANNEL_ID || '',
        
        // Channel where approved reviews are posted
        reviewsChannel: process.env.REVIEWS_CHANNEL_ID || '',
        
        // Channel for logging staff actions
        logsChannel: process.env.LOGS_CHANNEL_ID || ''
    },

    // Role IDs
    roles: {
        // Role ID for staff members who can approve/deny reviews
        staffRole: process.env.STAFF_ROLE_ID || ''
    },

    // Cooldown Settings (in milliseconds)
    cooldowns: {
        // Cooldown between review requests (default: 24 hours)
        reviewRequest: parseInt(process.env.REVIEW_REQUEST_COOLDOWN) || 24 * 60 * 60 * 1000,
        
        // Cooldown between review submissions (default: 1 hour)
        reviewSubmission: parseInt(process.env.REVIEW_SUBMISSION_COOLDOWN) || 60 * 60 * 1000
    },

    // Feature Toggles
    features: {
        // Allow anonymous reviews (can be toggled by staff)
        allowAnonymous: process.env.ALLOW_ANONYMOUS === 'true' || false,
        
        // Enable cooldown system
        enableCooldowns: process.env.ENABLE_COOLDOWNS !== 'false' // Default: true
    },

    // Review Settings
    review: {
        // Minimum review text length
        minTextLength: 10,
        
        // Maximum review text length
        maxTextLength: 2000,
        
        // Minimum rating
        minRating: 1,
        
        // Maximum rating
        maxRating: 5
    }
};
