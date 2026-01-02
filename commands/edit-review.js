const { SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const Review = require('../models/Review');
const { createErrorEmbed, createSuccessEmbed } = require('../utils/embeds');
const { canManageReviews } = require('../utils/permissions');
const { logAction } = require('../utils/logger');
const { getGuildSettings } = require('../utils/guildSettings');
const StaffActionLog = require('../models/StaffActionLog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('edit-review')
        .setDescription('Edit a review (Staff only)')
        .addStringOption(option =>
            option
                .setName('review-id')
                .setDescription('The ID of the review to edit')
                .setRequired(true)
        ),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const guildId = interaction.guild.id;
        
        // Check permissions
        if (!(await canManageReviews(interaction.member, guildId))) {
            return interaction.editReply({
                embeds: [createErrorEmbed('You do not have permission to use this command.')]
            });
        }
        
        const reviewId = interaction.options.getString('review-id');
        
        try {
            // Find review
            const review = await Review.findOne({
                _id: reviewId,
                guildId: guildId
            });
            
            if (!review) {
                return interaction.editReply({
                    embeds: [createErrorEmbed('Review not found.')]
                });
            }
            
            // Check if review is deleted
            if (review.deletedAt || review.status === 'deleted') {
                return interaction.editReply({
                    embeds: [createErrorEmbed('This review has been deleted.')]
                });
            }
            
            const settings = await getGuildSettings(guildId);
            
            // Create modal for editing
            const modal = new ModalBuilder()
                .setCustomId(`edit_review_${guildId}_${reviewId}_${interaction.user.id}`)
                .setTitle('Edit Review');
            
            const reviewTextInput = new TextInputBuilder()
                .setCustomId('review_text')
                .setLabel('Review Text')
                .setStyle(TextInputStyle.Paragraph)
                .setValue(review.reviewText)
                .setRequired(true)
                .setMinLength(settings.review.minTextLength)
                .setMaxLength(settings.review.maxTextLength);
            
            const ratingInput = new TextInputBuilder()
                .setCustomId('rating')
                .setLabel('Rating (1-5)')
                .setStyle(TextInputStyle.Short)
                .setValue(review.rating.toString())
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(1);
            
            const firstRow = new ActionRowBuilder().addComponents(reviewTextInput);
            const secondRow = new ActionRowBuilder().addComponents(ratingInput);
            
            modal.addComponents(firstRow, secondRow);
            
            await interaction.showModal(modal);
            
        } catch (error) {
            console.error('Error editing review:', error);
            await interaction.editReply({
                embeds: [createErrorEmbed('An error occurred while processing your request.')]
            });
        }
    }
};
