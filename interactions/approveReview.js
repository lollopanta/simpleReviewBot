const { StringSelectMenuBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const ReviewRequest = require('../models/ReviewRequest');
const Product = require('../models/Product');
const { createApprovalEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embeds');
const { isStaff } = require('../utils/permissions');
const { logAction } = require('../utils/logger');
const StaffActionLog = require('../models/StaffActionLog');

/**
 * Handles the approve review button click
 * Shows a product selection menu
 */
async function handleApproveReviewButton(interaction) {
    const guildId = interaction.guild.id;
    
    // Check if user is staff
    if (!(await isStaff(interaction.member, guildId))) {
        return interaction.reply({
            embeds: [createErrorEmbed('You do not have permission to approve review requests.')],
            ephemeral: true
        });
    }
    
    await interaction.deferUpdate();
    
    try {
        // Parse custom ID: approve_review_${guildId}_${userId}_${timestamp}
        const parts = interaction.customId.split('_');
        const userId = parts[3];
        
        // Find the review request
        const reviewRequest = await ReviewRequest.findOne({
            guildId: guildId,
            userId: userId,
            status: 'pending'
        });
        
        if (!reviewRequest) {
            return interaction.followUp({
                embeds: [createErrorEmbed('Review request not found or already processed.')],
                ephemeral: true
            });
        }
        
        // Get all active products for this guild
        const products = await Product.getGuildProducts(guildId);
        
        if (products.length === 0) {
            return interaction.followUp({
                embeds: [createErrorEmbed('No products available. Please create a product first using /product add.')],
                ephemeral: true
            });
        }
        
        // Create product select menu
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`select_product_${guildId}_${userId}_${Date.now()}`)
            .setPlaceholder('Select a product for this review...')
            .addOptions(
                products.slice(0, 25).map(product => ({
                    label: product.name,
                    description: `€${product.price.toFixed(2)} - ${product.reviewCount} reviews`,
                    value: product._id.toString()
                }))
            );
        
        const row = new ActionRowBuilder().addComponents(selectMenu);
        
        await interaction.followUp({
            content: '**Select the product for this review:**',
            components: [row],
            ephemeral: true
        });
        
    } catch (error) {
        console.error('Error in approve review button:', error);
        await interaction.followUp({
            embeds: [createErrorEmbed('An error occurred while processing the approval.')],
            ephemeral: true
        });
    }
}

/**
 * Handles product selection for approval
 * Shows optional staff note modal
 */
async function handleProductSelection(interaction) {
    const guildId = interaction.guild.id;
    
    // Check if user is staff
    if (!(await isStaff(interaction.member, guildId))) {
        return interaction.reply({
            embeds: [createErrorEmbed('You do not have permission to approve review requests.')],
            ephemeral: true
        });
    }
    
    await interaction.deferUpdate();
    
    try {
        // Parse custom ID: select_product_${guildId}_${userId}_${timestamp}
        const parts = interaction.customId.split('_');
        const userId = parts[2];
        const productId = interaction.values[0];
        
        // Find the review request
        const reviewRequest = await ReviewRequest.findOne({
            guildId: guildId,
            userId: userId,
            status: 'pending'
        });
        
        if (!reviewRequest) {
            return interaction.followUp({
                embeds: [createErrorEmbed('Review request not found or already processed.')],
                ephemeral: true
            });
        }
        
        // Verify product exists
        const product = await Product.getProduct(productId, guildId);
        if (!product) {
            return interaction.followUp({
                embeds: [createErrorEmbed('Product not found.')],
                ephemeral: true
            });
        }
        
        // Show modal for optional staff note
        const modal = new ModalBuilder()
            .setCustomId(`approve_with_note_${guildId}_${userId}_${productId}_${Date.now()}`)
            .setTitle('Approve Review Request');
        
        const noteInput = new TextInputBuilder()
            .setCustomId('staff_note')
            .setLabel('Internal Note (Optional)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Add an internal note for this approval...')
            .setRequired(false)
            .setMaxLength(500);
        
        const row = new ActionRowBuilder().addComponents(noteInput);
        modal.addComponents(row);
        
        await interaction.showModal(modal);
        
    } catch (error) {
        console.error('Error in product selection:', error);
        await interaction.followUp({
            embeds: [createErrorEmbed('An error occurred while processing the selection.')],
            ephemeral: true
        });
    }
}

/**
 * Handles the final approval after product selection and optional note
 */
async function handleFinalApproval(interaction) {
    const guildId = interaction.guild.id;
    
    // Check if user is staff
    if (!(await isStaff(interaction.member, guildId))) {
        return interaction.reply({
            embeds: [createErrorEmbed('You do not have permission to approve review requests.')],
            ephemeral: true
        });
    }
    
    await interaction.deferUpdate();
    
    try {
        // Parse custom ID: approve_with_note_${guildId}_${userId}_${productId}_${timestamp}
        const parts = interaction.customId.split('_');
        const userId = parts[3];
        const productId = parts[4];
        const staffNote = interaction.fields.getTextInputValue('staff_note') || null;
        
        // Find the review request
        const reviewRequest = await ReviewRequest.findOne({
            guildId: guildId,
            userId: userId,
            status: 'pending'
        });
        
        if (!reviewRequest) {
            return interaction.followUp({
                embeds: [createErrorEmbed('Review request not found or already processed.')],
                ephemeral: true
            });
        }
        
        // Verify product exists
        const product = await Product.getProduct(productId, guildId);
        if (!product) {
            return interaction.followUp({
                embeds: [createErrorEmbed('Product not found.')],
                ephemeral: true
            });
        }
        
        // Calculate processing time
        const processingTime = Date.now() - reviewRequest.createdAt.getTime();
        
        // Update request status
        reviewRequest.status = 'approved';
        reviewRequest.staffMemberId = interaction.user.id;
        reviewRequest.productId = productId;
        reviewRequest.staffNote = staffNote;
        reviewRequest.processedAt = new Date();
        await reviewRequest.save();
        
        // Update the original request message
        const originalMessage = await interaction.client.channels.fetch(reviewRequest.requestChannelId)
            .then(channel => channel.messages.fetch(reviewRequest.requestMessageId))
            .catch(() => null);
        
        if (originalMessage) {
            const embed = originalMessage.embeds[0];
            embed.setColor(0x57F287); // Green
            embed.setTitle('✅ Review Request - Approved');
            embed.addFields(
                { name: 'Approved By', value: `${interaction.user}`, inline: false },
                { name: 'Product', value: `**${product.name}** - €${product.price.toFixed(2)}`, inline: false }
            );
            
            if (staffNote) {
                embed.addFields({ name: 'Staff Note', value: staffNote, inline: false });
            }
            
            // Disable buttons
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('approved')
                        .setLabel('Approved')
                        .setStyle(ButtonStyle.Success)
                        .setDisabled(true),
                    new ButtonBuilder()
                        .setCustomId('denied')
                        .setLabel('Deny')
                        .setStyle(ButtonStyle.Danger)
                        .setDisabled(true)
                );
            
            await originalMessage.edit({
                embeds: [embed],
                components: [row]
            });
        }
        
        // Send DM to user
        try {
            const user = await interaction.client.users.fetch(userId);
            const approvalEmbed = createApprovalEmbed(interaction.member);
            approvalEmbed.addFields({
                name: 'Product',
                value: `**${product.name}** - €${product.price.toFixed(2)}`,
                inline: false
            });
            
            // Create button to submit review
            const submitButton = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`submit_review_${guildId}_${userId}_${Date.now()}`)
                        .setLabel('Submit Review')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('📝')
                );
            
            await user.send({
                embeds: [approvalEmbed],
                components: [submitButton]
            });
        } catch (error) {
            console.error('Error sending DM to user:', error);
            // Continue even if DM fails
        }
        
        // Log the action
        await StaffActionLog.create({
            guildId: guildId,
            staffMemberId: interaction.user.id,
            staffMemberUsername: interaction.user.tag,
            actionType: 'approve',
            targetType: 'review_request',
            targetId: reviewRequest._id.toString(),
            processingTime: processingTime,
            metadata: {
                userId: userId,
                productId: productId,
                productName: product.name,
                staffNote: staffNote
            }
        });
        
        await logAction(
            interaction.client,
            'approve',
            interaction.member,
            `Approved review request from ${reviewRequest.requesterUsername} (${userId}) for product "${product.name}"`,
            guildId
        );
        
        await interaction.followUp({
            embeds: [createSuccessEmbed('Review request approved successfully!')],
            ephemeral: true
        });
        
    } catch (error) {
        console.error('Error in final approval:', error);
        await interaction.followUp({
            embeds: [createErrorEmbed('An error occurred while processing the approval.')],
            ephemeral: true
        });
    }
}

module.exports = {
    handleApproveReviewButton,
    handleProductSelection,
    handleFinalApproval
};
