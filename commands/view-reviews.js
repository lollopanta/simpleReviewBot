const { SlashCommandBuilder } = require('discord.js');
const Review = require('../models/Review');
const { createUserReviewsEmbed, createErrorEmbed } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('view-reviews')
        .setDescription('View reviews for a user')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to view reviews for')
                .setRequired(false)
        ),
    
    async execute(interaction) {
        await interaction.deferReply();
        
        // Get target user (defaults to command user)
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guild.id;
        
        try {
            // Get reviews and average rating
            const reviews = await Review.getUserReviews(targetUser.id, guildId, 10);
            const stats = await Review.getAverageRating(targetUser.id, guildId);
            
            // Create embed
            const embed = createUserReviewsEmbed(
                targetUser,
                reviews,
                stats.averageRating,
                stats.totalReviews
            );
            
            await interaction.editReply({ embeds: [embed] });
            
        } catch (error) {
            console.error('Error viewing reviews:', error);
            await interaction.editReply({
                embeds: [createErrorEmbed('An error occurred while fetching reviews. Please try again later.')]
            });
        }
    }
};
