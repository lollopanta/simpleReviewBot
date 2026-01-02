const { EmbedBuilder } = require('discord.js');
const { createLogEmbed } = require('./embeds');
const { getGuildSettings } = require('./guildSettings');

/**
 * Utility functions for logging staff actions
 */

/**
 * Logs a staff action to the logs channel
 */
async function logAction(client, action, staffMember, details, guildId) {
    if (!guildId) {
        console.warn('Guild ID not provided. Skipping log.');
        return;
    }
    
    const settings = await getGuildSettings(guildId);
    const logsChannelId = settings.channels.logsChannel;
    
    if (!logsChannelId) {
        console.warn('Logs channel not configured. Skipping log.');
        return;
    }
    
    try {
        const logsChannel = await client.channels.fetch(logsChannelId);
        if (!logsChannel) {
            console.warn('Logs channel not found. Skipping log.');
            return;
        }
        
        const embed = createLogEmbed(action, staffMember, details);
        await logsChannel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error logging action:', error);
    }
}

/**
 * Formats a duration in milliseconds to a human-readable string
 */
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

module.exports = {
    logAction,
    formatDuration
};
