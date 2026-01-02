const { PermissionFlagsBits } = require('discord.js');
const { getGuildSettings } = require('./guildSettings');

/**
 * Utility functions for permission checks
 */

/**
 * Checks if a member has administrator permissions
 */
function isAdministrator(member) {
    if (!member) return false;
    return member.permissions.has(PermissionFlagsBits.Administrator);
}

/**
 * Checks if a member has staff permissions (based on guild settings)
 */
async function isStaff(member, guildId) {
    if (!member || !member.roles) return false;
    
    // Admins are always staff
    if (isAdministrator(member)) return true;
    
    const settings = await getGuildSettings(guildId);
    const staffRoleId = settings.roles.staffRole;
    
    if (!staffRoleId) return false;
    
    return member.roles.cache.has(staffRoleId);
}

/**
 * Checks if a member can manage reviews (staff only)
 */
async function canManageReviews(member, guildId) {
    return await isStaff(member, guildId);
}

/**
 * Checks if a member can manage products (staff/admin only)
 */
async function canManageProducts(member, guildId) {
    return await isStaff(member, guildId);
}

/**
 * Checks if a channel is the staff review channel (based on guild settings)
 */
async function isStaffReviewChannel(channelId, guildId) {
    const settings = await getGuildSettings(guildId);
    return channelId === settings.channels.staffReviewChannel;
}

/**
 * Checks if a channel is the reviews channel (based on guild settings)
 */
async function isReviewsChannel(channelId, guildId) {
    const settings = await getGuildSettings(guildId);
    return channelId === settings.channels.reviewsChannel;
}

/**
 * Checks if a channel is the logs channel (based on guild settings)
 */
async function isLogsChannel(channelId, guildId) {
    const settings = await getGuildSettings(guildId);
    return channelId === settings.channels.logsChannel;
}

module.exports = {
    isAdministrator,
    isStaff,
    canManageReviews,
    canManageProducts,
    isStaffReviewChannel,
    isReviewsChannel,
    isLogsChannel
};
