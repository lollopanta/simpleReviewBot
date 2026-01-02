const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const ReviewRequest = require('../models/ReviewRequest');
const { createReviewRequestEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embeds');
const { canRequestReview, recordReviewRequest } = require('../utils/cooldown');
const { getGuildSettings } = require('../utils/guildSettings');
const Review = require('../models/Review');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('request-review')
        .setDescription('Request permission to submit a review'),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const userId = interaction.user.id;
        const user = interaction.user;
        const guildId = interaction.guild.id;
        
        // Get guild settings
        const settings = await getGuildSettings(guildId);
        
        // Check cooldown
        const cooldownCheck = await canRequestReview(userId, guildId);
        if (!cooldownCheck.allowed) {
            return interaction.editReply({
                embeds: [createErrorEmbed(
                    `You must wait ${cooldownCheck.formatted} before requesting another review.`
                )]
            });
        }
        
        // Check if user already has an active pending request
        const hasActiveRequest = await ReviewRequest.hasActiveRequest(userId, guildId);
        if (hasActiveRequest) {
            return interaction.editReply({
                embeds: [createErrorEmbed(
                    'You already have a pending review request. Please wait for staff to approve or deny it.'
                )]
            });
        }
        
        // Check max reviews per user
        if (settings.review.maxReviewsPerUser) {
            const userReviews = await Review.countDocuments({
                userId,
                guildId,
                status: 'approved',
                deletedAt: null
            });
            
            if (userReviews >= settings.review.maxReviewsPerUser) {
                return interaction.editReply({
                    embeds: [createErrorEmbed(
                        `You have reached the maximum number of reviews (${settings.review.maxReviewsPerUser}).`
                    )]
                });
            }
        }
        
        // Get staff review channel
        const staffChannelId = settings.channels.staffReviewChannel;
        if (!staffChannelId) {
            return interaction.editReply({
                embeds: [createErrorEmbed('Staff review channel is not configured. Please contact an administrator.')]
            });
        }
        
        try {
            const staffChannel = await interaction.client.channels.fetch(staffChannelId);
            if (!staffChannel) {
                return interaction.editReply({
                    embeds: [createErrorEmbed('Staff review channel not found. Please contact an administrator.')]
                });
            }
            
            // Create request ID
            const requestId = `REQ-${Date.now()}-${userId.slice(-6)}`;
            
            // Create embed
            const embed = createReviewRequestEmbed(user, requestId);
            
            // Create approve/deny buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`approve_review_${guildId}_${userId}_${Date.now()}`)
                        .setLabel('Approve')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji('✅'),
                    new ButtonBuilder()
                        .setCustomId(`deny_review_${guildId}_${userId}_${Date.now()}`)
                        .setLabel('Deny')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('❌')
                );
            
            // Send request to staff channel
            const requestMessage = await staffChannel.send({
                embeds: [embed],
                components: [row]
            });
            
            // Create review request in database
            await ReviewRequest.create({
                guildId: guildId,
                userId: userId,
                requesterUsername: user.tag,
                requestMessageId: requestMessage.id,
                requestChannelId: staffChannel.id,
                status: 'pending'
            });
            
            // Record cooldown
            await recordReviewRequest(userId, guildId);
            
            // Confirm to user
            await interaction.editReply({
                embeds: [createSuccessEmbed(
                    'Your review request has been submitted! Staff will review it shortly.'
                )]
            });
            
        } catch (error) {
            console.error('Error creating review request:', error);
            await interaction.editReply({
                embeds: [createErrorEmbed('An error occurred while processing your request. Please try again later.')]
            });
        }
    }
};
