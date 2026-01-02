const { EmbedBuilder } = require('discord.js');

/**
 * Utility functions for creating Discord embeds
 */

/**
 * Creates an embed for a review request panel
 */
function createReviewRequestEmbed(user, requestId) {
    return new EmbedBuilder()
        .setTitle('📝 Review Request')
        .setDescription(`**${user.tag}** (${user.id}) has requested permission to submit a review.`)
        .addFields(
            { name: '👤 User', value: `${user}`, inline: true },
            { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
            { name: '📅 Requested At', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: false }
        )
        .setColor(0x5865F2) // Discord blurple
        .setFooter({ text: `Request ID: ${requestId}` })
        .setTimestamp();
}

/**
 * Creates an embed for an approved review request notification
 */
function createApprovalEmbed(staffMember) {
    return new EmbedBuilder()
        .setTitle('✅ Review Request Approved')
        .setDescription('Your review request has been approved! You can now submit your review using the button below.')
        .setColor(0x57F287) // Discord green
        .setFooter({ text: `Approved by ${staffMember.tag}` })
        .setTimestamp();
}

/**
 * Creates an embed for a denied review request notification
 */
function createDenialEmbed(staffMember, reason) {
    return new EmbedBuilder()
        .setTitle('❌ Review Request Denied')
        .setDescription('Your review request has been denied.')
        .addFields(
            { name: 'Reason', value: reason || 'No reason provided', inline: false }
        )
        .setColor(0xED4245) // Discord red
        .setFooter({ text: `Denied by ${staffMember.tag}` })
        .setTimestamp();
}

/**
 * Creates an embed for a submitted review
 */
function createReviewEmbed(review, product = null, isAnonymous = false) {
    const stars = '⭐'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
    
    const embed = new EmbedBuilder()
        .setTitle('⭐ New Review')
        .setDescription(review.reviewText)
        .addFields(
            { name: 'Rating', value: `${stars} (${review.rating}/5)`, inline: false },
            { name: 'Submitted', value: `<t:${Math.floor(review.timestamp.getTime() / 1000)}:R>`, inline: true }
        )
        .setColor(0xFEE75C) // Discord yellow
        .setTimestamp(review.timestamp);
    
    // Add product information if available
    if (product) {
        embed.addFields({
            name: 'Product',
            value: `**${product.name}** - €${product.price.toFixed(2)}`,
            inline: true
        });
    }
    
    if (!isAnonymous) {
        embed.setAuthor({ 
            name: review.reviewerUsername,
            iconURL: `https://cdn.discordapp.com/avatars/${review.userId}/avatar.png?size=256`
        });
    } else {
        embed.setAuthor({ name: 'Anonymous Reviewer' });
    }
    
    return embed;
}

/**
 * Creates an embed for user reviews profile
 */
function createUserReviewsEmbed(user, reviews, averageRating, totalReviews) {
    const stars = '⭐'.repeat(Math.round(averageRating)) + '☆'.repeat(5 - Math.round(averageRating));
    
    const embed = new EmbedBuilder()
        .setTitle(`📊 Reviews for ${user.tag}`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true }))
        .addFields(
            { name: 'Average Rating', value: `${stars} (${averageRating.toFixed(1)}/5)`, inline: true },
            { name: 'Total Reviews', value: `${totalReviews}`, inline: true }
        )
        .setColor(0x5865F2)
        .setTimestamp();
    
    if (reviews.length === 0) {
        embed.setDescription('No reviews found for this user.');
    } else {
        // Add review summaries (limit to 5 most recent)
        const reviewList = reviews.slice(0, 5).map((review, index) => {
            const reviewStars = '⭐'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
            const reviewPreview = review.reviewText.length > 100 
                ? review.reviewText.substring(0, 100) + '...' 
                : review.reviewText;
            return `**${index + 1}.** ${reviewStars} - ${reviewPreview}`;
        }).join('\n\n');
        
        embed.addFields({ name: 'Recent Reviews', value: reviewList || 'No reviews', inline: false });
    }
    
    return embed;
}

/**
 * Creates an embed for staff action logs
 */
function createLogEmbed(action, staffMember, details) {
    const colors = {
        approve: 0x57F287, // Green
        deny: 0xED4245,   // Red
        edit: 0xFEE75C,   // Yellow
        delete: 0xED4245  // Red
    };
    
    const emojis = {
        approve: '✅',
        deny: '❌',
        edit: '✏️',
        delete: '🗑️'
    };
    
    return new EmbedBuilder()
        .setTitle(`${emojis[action]} Staff Action: ${action.toUpperCase()}`)
        .setDescription(details)
        .setColor(colors[action] || 0x5865F2)
        .setFooter({ text: `Staff: ${staffMember.tag} (${staffMember.id})` })
        .setTimestamp();
}

/**
 * Creates an embed for error messages
 */
function createErrorEmbed(message) {
    return new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription(message)
        .setColor(0xED4245)
        .setTimestamp();
}

/**
 * Creates an embed for success messages
 */
function createSuccessEmbed(message) {
    return new EmbedBuilder()
        .setTitle('✅ Success')
        .setDescription(message)
        .setColor(0x57F287)
        .setTimestamp();
}

/**
 * Creates an embed for product information
 */
function createProductEmbed(product, reviewCount = null, averageRating = null) {
    const embed = new EmbedBuilder()
        .setTitle(`📦 ${product.name}`)
        .setDescription(product.description || 'No description provided.')
        .addFields(
            { name: 'Price', value: `€${product.price.toFixed(2)}`, inline: true },
            { name: 'Product ID', value: `\`${product._id}\``, inline: true }
        )
        .setColor(0x5865F2)
        .setTimestamp(product.createdAt);
    
    if (reviewCount !== null && averageRating !== null) {
        const stars = '⭐'.repeat(Math.round(averageRating)) + '☆'.repeat(5 - Math.round(averageRating));
        embed.addFields(
            { name: 'Reviews', value: `${reviewCount}`, inline: true },
            { name: 'Average Rating', value: `${stars} (${averageRating.toFixed(1)}/5)`, inline: true }
        );
    }
    
    return embed;
}

/**
 * Creates an embed for settings panel
 */
function createSettingsEmbed(settings) {
    const embed = new EmbedBuilder()
        .setTitle('⚙️ Bot Settings')
        .setDescription('Current configuration for this server')
        .setColor(0x5865F2)
        .setTimestamp();
    
    // Channels
    const channels = [];
    if (settings.channels.staffReviewChannel) channels.push(`✅ Staff Review: <#${settings.channels.staffReviewChannel}>`);
    else channels.push('❌ Staff Review: Not set');
    if (settings.channels.reviewsChannel) channels.push(`✅ Reviews: <#${settings.channels.reviewsChannel}>`);
    else channels.push('❌ Reviews: Not set');
    if (settings.channels.logsChannel) channels.push(`✅ Logs: <#${settings.channels.logsChannel}>`);
    else channels.push('❌ Logs: Not set');
    
    embed.addFields({ name: 'Channels', value: channels.join('\n'), inline: false });
    
    // Roles
    const roles = [];
    if (settings.roles.staffRole) roles.push(`✅ Staff Role: <@&${settings.roles.staffRole}>`);
    else roles.push('❌ Staff Role: Not set');
    
    embed.addFields({ name: 'Roles', value: roles.join('\n'), inline: false });
    
    // Features
    const features = [];
    features.push(`Anonymous Reviews: ${settings.features.allowAnonymous ? '✅ Enabled' : '❌ Disabled'}`);
    features.push(`Cooldowns: ${settings.features.enableCooldowns ? '✅ Enabled' : '❌ Disabled'}`);
    features.push(`Auto-Approval: ${settings.features.autoApproval ? '✅ Enabled' : '❌ Disabled'}`);
    features.push(`Review Edits: ${settings.features.allowReviewEdits ? '✅ Allowed' : '❌ Not Allowed'}`);
    
    embed.addFields({ name: 'Features', value: features.join('\n'), inline: false });
    
    // Cooldowns
    const reviewRequestCooldown = Math.floor(settings.cooldowns.reviewRequest / (1000 * 60 * 60));
    const reviewSubmissionCooldown = Math.floor(settings.cooldowns.reviewSubmission / (1000 * 60));
    
    embed.addFields(
        { name: 'Review Request Cooldown', value: `${reviewRequestCooldown} hours`, inline: true },
        { name: 'Review Submission Cooldown', value: `${reviewSubmissionCooldown} minutes`, inline: true }
    );
    
    // Review limits
    const maxReviews = settings.review.maxReviewsPerUser || 'Unlimited';
    embed.addFields({ name: 'Max Reviews Per User', value: `${maxReviews}`, inline: true });
    
    return embed;
}

/**
 * Creates an embed for statistics overview
 */
function createStatsOverviewEmbed(stats, guildName) {
    const embed = new EmbedBuilder()
        .setTitle(`📊 Statistics for ${guildName}`)
        .setColor(0x5865F2)
        .setTimestamp();
    
    embed.addFields(
        { name: 'Total Reviews', value: `${stats.total}`, inline: true },
        { name: 'Approved', value: `${stats.approved}`, inline: true },
        { name: 'Pending', value: `${stats.pending}`, inline: true },
        { name: 'Denied', value: `${stats.denied}`, inline: true },
        { name: 'Average Rating', value: `${stats.averageRating.toFixed(1)}/5`, inline: true }
    );
    
    return embed;
}

/**
 * Creates an embed for product statistics
 */
function createProductStatsEmbed(products) {
    const embed = new EmbedBuilder()
        .setTitle('📦 Product Statistics')
        .setColor(0x5865F2)
        .setTimestamp();
    
    if (products.length === 0) {
        embed.setDescription('No products found.');
        return embed;
    }
    
    // Sort by review count (descending)
    const sortedProducts = products.sort((a, b) => b.reviewCount - a.reviewCount);
    const topProducts = sortedProducts.slice(0, 10);
    
    const productList = topProducts.map((product, index) => {
        const stars = '⭐'.repeat(Math.round(product.averageRating)) + '☆'.repeat(5 - Math.round(product.averageRating));
        return `${index + 1}. **${product.name}** - ${product.reviewCount} reviews - ${stars} (${product.averageRating.toFixed(1)}/5)`;
    }).join('\n');
    
    embed.setDescription(productList);
    
    return embed;
}

module.exports = {
    createReviewRequestEmbed,
    createApprovalEmbed,
    createDenialEmbed,
    createReviewEmbed,
    createUserReviewsEmbed,
    createLogEmbed,
    createErrorEmbed,
    createSuccessEmbed,
    createProductEmbed,
    createSettingsEmbed,
    createStatsOverviewEmbed,
    createProductStatsEmbed
};
