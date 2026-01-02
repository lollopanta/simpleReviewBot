const { SlashCommandBuilder } = require('discord.js');
const Review = require('../models/Review');
const Product = require('../models/Product');
const { createErrorEmbed, createSuccessEmbed } = require('../utils/embeds');
const { canManageReviews } = require('../utils/permissions');
const { logAction } = require('../utils/logger');
const StaffActionLog = require('../models/StaffActionLog');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('delete-review')
        .setDescription('Delete a review (Staff only)')
        .addStringOption(option =>
            option
                .setName('review-id')
                .setDescription('The ID of the review to delete')
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
            
            // Check if already deleted
            if (review.deletedAt || review.status === 'deleted') {
                return interaction.editReply({
                    embeds: [createErrorEmbed('This review has already been deleted.')]
                });
            }
            
            // Delete the review message if it exists
            if (review.messageId && review.channelId) {
                try {
                    const channel = await interaction.client.channels.fetch(review.channelId);
                    if (channel) {
                        const message = await channel.messages.fetch(review.messageId);
                        if (message) {
                            await message.delete();
                        }
                    }
                } catch (error) {
                    console.error('Error deleting review message:', error);
                    // Continue with database deletion even if message deletion fails
                }
            }
            
            // Soft delete (set deletedAt timestamp)
            review.deletedAt = new Date();
            review.status = 'deleted';
            review.lastEditedBy = interaction.user.id;
            review.lastEditedAt = new Date();
            await review.save();
            
            // Update product rating stats
            const product = await Product.findById(review.productId);
            if (product) {
                await product.updateRatingStats();
            }
            
            // Log the action
            await StaffActionLog.create({
                guildId: guildId,
                staffMemberId: interaction.user.id,
                staffMemberUsername: interaction.user.tag,
                actionType: 'delete',
                targetType: 'review',
                targetId: reviewId,
                metadata: {
                    reviewUserId: review.userId,
                    reviewUsername: review.reviewerUsername,
                    productId: review.productId.toString()
                }
            });
            
            await logAction(
                interaction.client,
                'delete',
                interaction.member,
                `Deleted review ${reviewId} by ${review.reviewerUsername} (${review.userId})`,
                guildId
            );
            
            await interaction.editReply({
                embeds: [createSuccessEmbed(`Review ${reviewId} has been deleted successfully.`)]
            });
            
        } catch (error) {
            console.error('Error deleting review:', error);
            await interaction.editReply({
                embeds: [createErrorEmbed('An error occurred while deleting the review.')]
            });
        }
    }
};
