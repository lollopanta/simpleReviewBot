const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const ReviewRequest = require('../models/ReviewRequest');
const Review = require('../models/Review');
const Product = require('../models/Product');
const { createApprovalEmbed, createDenialEmbed, createReviewEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embeds');
const { isStaff } = require('../utils/permissions');
const { canSubmitReview, recordReviewSubmission } = require('../utils/cooldown');
const { logAction } = require('../utils/logger');
const { getGuildSettings } = require('../utils/guildSettings');
const StaffActionLog = require('../models/StaffActionLog');
const approveReviewHandlers = require('../interactions/approveReview');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            const command = interaction.client.commands.get(interaction.commandName);
            
            if (!command) {
                console.error(`No command matching ${interaction.commandName} was found.`);
                return;
            }
            
            try {
                await command.execute(interaction);
            } catch (error) {
                console.error(`Error executing command ${interaction.commandName}:`, error);
                
                const errorMessage = {
                    embeds: [createErrorEmbed('There was an error while executing this command!')],
                    ephemeral: true
                };
                
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorMessage);
                } else {
                    await interaction.reply(errorMessage);
                }
            }
            return;
        }
        
        // Handle button interactions
        if (interaction.isButton()) {
            await handleButtonInteraction(interaction);
            return;
        }
        
        // Handle select menu interactions
        if (interaction.isStringSelectMenu()) {
            await handleSelectMenuInteraction(interaction);
            return;
        }
        
        // Handle modal submissions
        if (interaction.isModalSubmit()) {
            await handleModalInteraction(interaction);
            return;
        }
    }
};

/**
 * Handles button interactions (approve/deny review requests)
 */
async function handleButtonInteraction(interaction) {
    const customId = interaction.customId;
    
    // Handle approve review request (shows product selection)
    if (customId.startsWith('approve_review_')) {
        await approveReviewHandlers.handleApproveReviewButton(interaction);
        return;
    }
    
    // Handle deny review request
    if (customId.startsWith('deny_review_')) {
        await handleDenyReview(interaction);
        return;
    }
    
    // Handle submit review button (opens modal)
    if (customId.startsWith('submit_review_')) {
        await handleSubmitReviewButton(interaction);
        return;
    }
}

/**
 * Handles select menu interactions
 */
async function handleSelectMenuInteraction(interaction) {
    const customId = interaction.customId;
    
    // Handle product selection for approval
    if (customId.startsWith('select_product_')) {
        await approveReviewHandlers.handleProductSelection(interaction);
        return;
    }
}

// Approve review handlers are now in interactions/approveReview.js

/**
 * Handles denying a review request
 */
async function handleDenyReview(interaction) {
    const guildId = interaction.guild.id;
    
    // Check if user is staff
    if (!(await isStaff(interaction.member, guildId))) {
        return interaction.reply({
            embeds: [createErrorEmbed('You do not have permission to deny review requests.')],
            ephemeral: true
        });
    }
    
    // Show modal to get denial reason
    const modal = new ModalBuilder()
        .setCustomId(`deny_review_modal_${guildId}_${interaction.customId}`)
        .setTitle('Deny Review Request');
    
    const reasonInput = new TextInputBuilder()
        .setCustomId('denial_reason')
        .setLabel('Reason for Denial')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Enter the reason for denying this review request...')
        .setRequired(true)
        .setMaxLength(500);
    
    const row = new ActionRowBuilder().addComponents(reasonInput);
    modal.addComponents(row);
    
    await interaction.showModal(modal);
}

/**
 * Handles the submit review button (opens modal)
 */
async function handleSubmitReviewButton(interaction) {
    // Parse custom ID: submit_review_${guildId}_${userId}_${timestamp}
    const parts = interaction.customId.split('_');
    const guildId = parts[2];
    const userId = parts[3];
    
    // Verify this is the correct user
    if (interaction.user.id !== userId) {
        return interaction.reply({
            embeds: [createErrorEmbed('This button is not for you.')],
            ephemeral: true
        });
    }
    
    // Check if user has an approved request
    const reviewRequest = await ReviewRequest.findOne({
        guildId: guildId,
        userId: userId,
        status: 'approved'
    }).sort({ processedAt: -1 });
    
    if (!reviewRequest) {
        return interaction.reply({
            embeds: [createErrorEmbed('You do not have an approved review request.')],
            ephemeral: true
        });
    }
    
    // Check cooldown
    const cooldownCheck = await canSubmitReview(userId, guildId);
    if (!cooldownCheck.allowed) {
        return interaction.reply({
            embeds: [createErrorEmbed(
                `You must wait ${cooldownCheck.formatted} before submitting another review.`
            )],
            ephemeral: true
        });
    }
    
    const settings = await getGuildSettings(guildId);
    
    // Create modal for review submission
    const modal = new ModalBuilder()
        .setCustomId(`submit_review_modal_${guildId}_${userId}_${Date.now()}`)
        .setTitle('Submit Your Review');
    
    const reviewTextInput = new TextInputBuilder()
        .setCustomId('review_text')
        .setLabel('Your Review')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Write your review here...')
        .setRequired(true)
        .setMinLength(settings.review.minTextLength)
        .setMaxLength(settings.review.maxTextLength);
    
    const ratingInput = new TextInputBuilder()
        .setCustomId('rating')
        .setLabel('Rating (1-5)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter a number between 1 and 5')
        .setRequired(true)
        .setMinLength(1)
        .setMaxLength(1);
    
    const firstRow = new ActionRowBuilder().addComponents(reviewTextInput);
    const secondRow = new ActionRowBuilder().addComponents(ratingInput);
    
    modal.addComponents(firstRow, secondRow);
    
    await interaction.showModal(modal);
}

/**
 * Handles modal interactions
 */
async function handleModalInteraction(interaction) {
    const customId = interaction.customId;
    
        // Handle review submission modal
        if (customId.startsWith('submit_review_modal_')) {
            await handleReviewSubmission(interaction);
            return;
        }
        
        // Handle deny review modal
        if (customId.startsWith('deny_review_modal_')) {
            await handleDenyReviewModal(interaction);
            return;
        }
        
        // Handle approve with note modal (final approval)
        if (customId.startsWith('approve_with_note_')) {
            await approveReviewHandlers.handleFinalApproval(interaction);
            return;
        }
        
        // Handle edit review modal
        if (customId.startsWith('edit_review_')) {
            await handleEditReviewModal(interaction);
            return;
        }
}

/**
 * Handles review submission from modal
 */
async function handleReviewSubmission(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    // Parse custom ID: submit_review_modal_${guildId}_${userId}_${timestamp}
    const parts = interaction.customId.split('_');
    const guildId = parts[3];
    const userId = parts[4];
    
    // Verify this is the correct user
    if (interaction.user.id !== userId) {
        return interaction.editReply({
            embeds: [createErrorEmbed('This modal is not for you.')]
        });
    }
    
    // Get form values
    const reviewText = interaction.fields.getTextInputValue('review_text');
    const ratingInput = interaction.fields.getTextInputValue('rating');
    const rating = parseInt(ratingInput);
    
    const settings = await getGuildSettings(guildId);
    
    // Validate rating
    if (isNaN(rating) || rating < settings.review.minRating || rating > settings.review.maxRating) {
        return interaction.editReply({
            embeds: [createErrorEmbed(`Rating must be a number between ${settings.review.minRating} and ${settings.review.maxRating}.`)]
        });
    }
    
    // Check if user has an approved request
    const reviewRequest = await ReviewRequest.findOne({
        guildId: guildId,
        userId: userId,
        status: 'approved'
    }).sort({ processedAt: -1 }).populate('productId');
    
    if (!reviewRequest) {
        return interaction.editReply({
            embeds: [createErrorEmbed('You do not have an approved review request.')]
        });
    }
    
    if (!reviewRequest.productId) {
        return interaction.editReply({
            embeds: [createErrorEmbed('Your review request does not have an associated product. Please contact staff.')]
        });
    }
    
    try {
        // Get reviews channel
        const reviewsChannelId = settings.channels.reviewsChannel;
        if (!reviewsChannelId) {
            return interaction.editReply({
                embeds: [createErrorEmbed('Reviews channel is not configured.')]
            });
        }
        
        const reviewsChannel = await interaction.client.channels.fetch(reviewsChannelId);
        if (!reviewsChannel) {
            return interaction.editReply({
                embeds: [createErrorEmbed('Reviews channel not found.')]
            });
        }
        
        // Create review in database
        const review = await Review.create({
            guildId: guildId,
            productId: reviewRequest.productId._id,
            userId: userId,
            reviewerUsername: interaction.user.tag,
            reviewText: reviewText,
            rating: rating,
            staffApproverId: reviewRequest.staffMemberId,
            status: 'approved',
            anonymous: settings.features.allowAnonymous ? false : false // Can be made configurable per review
        });
        
        // Update product rating stats
        await reviewRequest.productId.updateRatingStats();
        
        // Create embed with product information
        const embed = createReviewEmbed(review, reviewRequest.productId, review.anonymous);
        
        // Post review to reviews channel
        const reviewMessage = await reviewsChannel.send({ embeds: [embed] });
        
        // Update review with message info
        review.messageId = reviewMessage.id;
        review.channelId = reviewsChannel.id;
        await review.save();
        
        // Record cooldown
        await recordReviewSubmission(userId, guildId);
        
        await interaction.editReply({
            embeds: [createSuccessEmbed('Your review has been submitted successfully!')]
        });
        
    } catch (error) {
        console.error('Error submitting review:', error);
        await interaction.editReply({
            embeds: [createErrorEmbed('An error occurred while submitting your review.')]
        });
    }
}

/**
 * Handles deny review modal submission
 */
async function handleDenyReviewModal(interaction) {
    await interaction.deferUpdate();
    
    const guildId = interaction.guild.id;
    
    // Check if user is staff
    if (!(await isStaff(interaction.member, guildId))) {
        return interaction.followUp({
            embeds: [createErrorEmbed('You do not have permission to deny review requests.')],
            ephemeral: true
        });
    }
    
    // Get denial reason
    const reason = interaction.fields.getTextInputValue('denial_reason');
    
    // Parse custom ID: deny_review_modal_${guildId}_approve_review_${guildId}_${userId}_${timestamp}
    const modalCustomId = interaction.customId;
    const parts = modalCustomId.split('_');
    const userId = parts[4]; // Adjust based on actual format
    
    // Try to find userId from the button custom ID stored in the modal
    // The format might vary, so we'll search for the request differently
    try {
        // Find the review request by finding the original message
        const originalMessage = interaction.message;
        if (!originalMessage) {
            throw new Error('Original message not found');
        }
        
        // Find request by message ID
        const reviewRequest = await ReviewRequest.findOne({
            guildId: guildId,
            requestMessageId: originalMessage.id,
            status: 'pending'
        });
        
        if (!reviewRequest) {
            // Fallback: try to find by parsing custom ID more carefully
            const buttonCustomId = parts.slice(4).join('_'); // Get the button custom ID part
            const buttonParts = buttonCustomId.split('_');
            const fallbackUserId = buttonParts[2] || buttonParts[1];
            
            const fallbackRequest = await ReviewRequest.findOne({
                guildId: guildId,
                userId: fallbackUserId,
                status: 'pending'
            });
            
            if (!fallbackRequest) {
                return interaction.followUp({
                    embeds: [createErrorEmbed('Review request not found or already processed.')],
                    ephemeral: true
                });
            }
            
            // Use fallback request
            reviewRequest = fallbackRequest;
        }
        
        // Calculate processing time
        const processingTime = Date.now() - reviewRequest.createdAt.getTime();
        
        // Update request status
        reviewRequest.status = 'denied';
        reviewRequest.staffMemberId = interaction.user.id;
        reviewRequest.processedAt = new Date();
        reviewRequest.denialReason = reason;
        await reviewRequest.save();
        
        // Update the message to show it's been denied
        const embed = originalMessage.embeds[0];
        embed.setColor(0xED4245); // Red
        embed.setTitle('❌ Review Request - Denied');
        embed.addFields(
            { name: 'Denied By', value: `${interaction.user}`, inline: false },
            { name: 'Reason', value: reason, inline: false }
        );
        
        // Disable buttons
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('approved')
                    .setLabel('Approve')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setCustomId('denied')
                    .setLabel('Denied')
                    .setStyle(ButtonStyle.Danger)
                    .setDisabled(true)
            );
        
        await originalMessage.edit({
            embeds: [embed],
            components: [row]
        });
        
        // Send DM to user
        try {
            const user = await interaction.client.users.fetch(reviewRequest.userId);
            const denialEmbed = createDenialEmbed(interaction.member, reason);
            await user.send({ embeds: [denialEmbed] });
        } catch (error) {
            console.error('Error sending DM to user:', error);
            // Continue even if DM fails
        }
        
        // Log the action
        await StaffActionLog.create({
            guildId: guildId,
            staffMemberId: interaction.user.id,
            staffMemberUsername: interaction.user.tag,
            actionType: 'deny',
            targetType: 'review_request',
            targetId: reviewRequest._id.toString(),
            processingTime: processingTime,
            metadata: {
                userId: reviewRequest.userId,
                denialReason: reason
            }
        });
        
        await logAction(
            interaction.client,
            'deny',
            interaction.member,
            `Denied review request from ${reviewRequest.requesterUsername} (${reviewRequest.userId}). Reason: ${reason}`,
            guildId
        );
        
    } catch (error) {
        console.error('Error denying review request:', error);
        await interaction.followUp({
            embeds: [createErrorEmbed('An error occurred while processing the denial.')],
            ephemeral: true
        });
    }
}

/**
 * Handles edit review modal submission
 */
async function handleEditReviewModal(interaction) {
    await interaction.deferReply({ ephemeral: true });
    
    const guildId = interaction.guild.id;
    
    // Check if user is staff
    if (!(await isStaff(interaction.member, guildId))) {
        return interaction.editReply({
            embeds: [createErrorEmbed('You do not have permission to edit reviews.')]
        });
    }
    
    // Parse custom ID: edit_review_${guildId}_${reviewId}_${staffId}
    const parts = interaction.customId.split('_');
    const reviewId = parts[2];
    
    // Get form values
    const reviewText = interaction.fields.getTextInputValue('review_text');
    const ratingInput = interaction.fields.getTextInputValue('rating');
    const rating = parseInt(ratingInput);
    
    const settings = await getGuildSettings(guildId);
    
    // Validate rating
    if (isNaN(rating) || rating < settings.review.minRating || rating > settings.review.maxRating) {
        return interaction.editReply({
            embeds: [createErrorEmbed(`Rating must be a number between ${settings.review.minRating} and ${settings.review.maxRating}.`)]
        });
    }
    
    try {
        // Find review
        const review = await Review.findOne({
            _id: reviewId,
            guildId: guildId
        }).populate('productId');
        
        if (!review) {
            return interaction.editReply({
                embeds: [createErrorEmbed('Review not found.')]
            });
        }
        
        // Update review
        const oldRating = review.rating;
        
        review.reviewText = reviewText;
        review.rating = rating;
        review.lastEditedBy = interaction.user.id;
        review.lastEditedAt = new Date();
        await review.save();
        
        // Update product rating stats
        if (review.productId) {
            await review.productId.updateRatingStats();
        }
        
        // Update the review message if it exists
        if (review.messageId && review.channelId) {
            try {
                const channel = await interaction.client.channels.fetch(review.channelId);
                if (channel) {
                    const message = await channel.messages.fetch(review.messageId);
                    if (message) {
                        const embed = createReviewEmbed(review, review.productId, review.anonymous);
                        await message.edit({ embeds: [embed] });
                    }
                }
            } catch (error) {
                console.error('Error updating review message:', error);
                // Continue even if message update fails
            }
        }
        
        // Log the action
        await StaffActionLog.create({
            guildId: guildId,
            staffMemberId: interaction.user.id,
            staffMemberUsername: interaction.user.tag,
            actionType: 'edit',
            targetType: 'review',
            targetId: reviewId,
            metadata: {
                oldRating: oldRating,
                newRating: rating,
                reviewUserId: review.userId
            }
        });
        
        await logAction(
            interaction.client,
            'edit',
            interaction.member,
            `Edited review ${reviewId} by ${review.reviewerUsername}. Changed rating from ${oldRating} to ${rating}.`,
            guildId
        );
        
        await interaction.editReply({
            embeds: [createSuccessEmbed(`Review ${reviewId} has been updated successfully.`)]
        });
        
    } catch (error) {
        console.error('Error editing review:', error);
        await interaction.editReply({
            embeds: [createErrorEmbed('An error occurred while editing the review.')]
        });
    }
}
