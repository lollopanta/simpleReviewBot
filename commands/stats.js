const { SlashCommandBuilder } = require('discord.js');
const Review = require('../models/Review');
const Product = require('../models/Product');
const StaffActionLog = require('../models/StaffActionLog');
const { createStatsOverviewEmbed, createProductStatsEmbed, createErrorEmbed } = require('../utils/embeds');
const { createUserReviewsEmbed } = require('../utils/embeds');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('View bot statistics')
        .addSubcommand(subcommand =>
            subcommand
                .setName('overview')
                .setDescription('View overall statistics')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('products')
                .setDescription('View product statistics')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('staff')
                .setDescription('View staff statistics')
                .addUserOption(option =>
                    option
                        .setName('staff_member')
                        .setDescription('Specific staff member to view stats for')
                        .setRequired(false)
                )
                .addIntegerOption(option =>
                    option
                        .setName('days')
                        .setDescription('Number of days to look back')
                        .setMinValue(1)
                        .setMaxValue(365)
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('View user review statistics')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('User to view stats for')
                        .setRequired(false)
                )
        ),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        
        await interaction.deferReply();
        
        try {
            if (subcommand === 'overview') {
                const stats = await Review.getGuildStats(guildId);
                
                // Get product count
                const productCount = await Product.countDocuments({
                    guildId,
                    active: true
                });
                
                // Get total review requests
                const ReviewRequest = require('../models/ReviewRequest');
                const requestStats = await ReviewRequest.aggregate([
                    {
                        $match: { guildId }
                    },
                    {
                        $group: {
                            _id: '$status',
                            count: { $sum: 1 }
                        }
                    }
                ]);
                
                const totalRequests = requestStats.reduce((sum, item) => sum + item.count, 0);
                const approvedRequests = requestStats.find(item => item._id === 'approved')?.count || 0;
                const deniedRequests = requestStats.find(item => item._id === 'denied')?.count || 0;
                
                const embed = createStatsOverviewEmbed(stats, interaction.guild.name);
                embed.addFields(
                    { name: 'Products', value: `${productCount}`, inline: true },
                    { name: 'Total Requests', value: `${totalRequests}`, inline: true },
                    { name: 'Approval Rate', value: totalRequests > 0 ? `${Math.round((approvedRequests / totalRequests) * 100)}%` : 'N/A', inline: true }
                );
                
                return interaction.editReply({ embeds: [embed] });
            }
            
            if (subcommand === 'products') {
                const products = await Product.getGuildProducts(guildId);
                
                if (products.length === 0) {
                    return interaction.editReply({
                        embeds: [createErrorEmbed('No products found.')]
                    });
                }
                
                // Update ratings for all products
                for (const product of products) {
                    await product.updateRatingStats();
                }
                
                // Refresh products
                const updatedProducts = await Product.getGuildProducts(guildId);
                
                const embed = createProductStatsEmbed(updatedProducts);
                
                // Add additional stats
                const totalReviews = updatedProducts.reduce((sum, p) => sum + p.reviewCount, 0);
                const avgRating = updatedProducts.length > 0
                    ? updatedProducts.reduce((sum, p) => sum + p.averageRating, 0) / updatedProducts.length
                    : 0;
                
                embed.addFields(
                    { name: 'Total Products', value: `${updatedProducts.length}`, inline: true },
                    { name: 'Total Reviews', value: `${totalReviews}`, inline: true },
                    { name: 'Average Rating (All Products)', value: `${avgRating.toFixed(1)}/5`, inline: true }
                );
                
                return interaction.editReply({ embeds: [embed] });
            }
            
            if (subcommand === 'staff') {
                const staffMember = interaction.options.getUser('staff_member');
                const days = interaction.options.getInteger('days') || 30;
                
                const staffStats = await StaffActionLog.getStaffStats(
                    guildId,
                    staffMember?.id || null,
                    days
                );
                
                if (staffStats.length === 0) {
                    return interaction.editReply({
                        embeds: [createErrorEmbed(`No staff activity found in the last ${days} days.`)]
                    });
                }
                
                const embed = new (require('discord.js').EmbedBuilder)()
                    .setTitle(`👥 Staff Statistics (Last ${days} days)`)
                    .setColor(0x5865F2)
                    .setTimestamp();
                
                if (staffMember) {
                    // Single staff member stats
                    const stats = staffStats[0];
                    if (!stats) {
                        return interaction.editReply({
                            embeds: [createErrorEmbed(`No activity found for ${staffMember.tag} in the last ${days} days.`)]
                        });
                    }
                    
                    embed.setDescription(`Statistics for ${staffMember}`)
                        .addFields(
                            { name: 'Total Actions', value: `${stats.totalActions}`, inline: true },
                            { name: 'Approvals', value: `${stats.approvals}`, inline: true },
                            { name: 'Denials', value: `${stats.denials}`, inline: true },
                            { name: 'Edits', value: `${stats.edits}`, inline: true },
                            { name: 'Deletes', value: `${stats.deletes}`, inline: true }
                        );
                    
                    if (stats.avgProcessingTime) {
                        const avgMinutes = Math.round(stats.avgProcessingTime / (1000 * 60));
                        embed.addFields({ name: 'Avg Processing Time', value: `${avgMinutes} minutes`, inline: true });
                    }
                } else {
                    // All staff stats
                    const totalActions = staffStats.reduce((sum, s) => sum + s.totalActions, 0);
                    const totalApprovals = staffStats.reduce((sum, s) => sum + s.approvals, 0);
                    const totalDenials = staffStats.reduce((sum, s) => sum + s.denials, 0);
                    
                    embed.setDescription(`Statistics for all staff members`)
                        .addFields(
                            { name: 'Active Staff', value: `${staffStats.length}`, inline: true },
                            { name: 'Total Actions', value: `${totalActions}`, inline: true },
                            { name: 'Total Approvals', value: `${totalApprovals}`, inline: true },
                            { name: 'Total Denials', value: `${totalDenials}`, inline: true }
                        );
                    
                    // Top staff members
                    const topStaff = staffStats
                        .sort((a, b) => b.totalActions - a.totalActions)
                        .slice(0, 5);
                    
                    if (topStaff.length > 0) {
                        const topStaffList = topStaff.map((stat, index) => {
                            return `${index + 1}. <@${stat._id}> - ${stat.totalActions} actions (${stat.approvals} approvals)`;
                        }).join('\n');
                        
                        embed.addFields({ name: 'Top Staff Members', value: topStaffList, inline: false });
                    }
                }
                
                return interaction.editReply({ embeds: [embed] });
            }
            
            if (subcommand === 'user') {
                const targetUser = interaction.options.getUser('user') || interaction.user;
                
                const reviews = await Review.getUserReviews(targetUser.id, guildId, 10);
                const stats = await Review.getAverageRating(targetUser.id, guildId);
                
                const embed = createUserReviewsEmbed(targetUser, reviews, stats.averageRating, stats.totalReviews);
                
                // Add product breakdown if available
                if (reviews.length > 0) {
                    const productBreakdown = {};
                    reviews.forEach(review => {
                        const productName = review.productId?.name || 'Unknown Product';
                        if (!productBreakdown[productName]) {
                            productBreakdown[productName] = { count: 0, totalRating: 0 };
                        }
                        productBreakdown[productName].count++;
                        productBreakdown[productName].totalRating += review.rating;
                    });
                    
                    const breakdownText = Object.entries(productBreakdown)
                        .map(([name, data]) => {
                            const avg = (data.totalRating / data.count).toFixed(1);
                            return `**${name}**: ${data.count} reviews (${avg}/5 avg)`;
                        })
                        .join('\n');
                    
                    if (breakdownText.length < 1000) {
                        embed.addFields({ name: 'Product Breakdown', value: breakdownText, inline: false });
                    }
                }
                
                return interaction.editReply({ embeds: [embed] });
            }
            
        } catch (error) {
            console.error('Error in stats command:', error);
            return interaction.editReply({
                embeds: [createErrorEmbed('An error occurred while fetching statistics.')]
            });
        }
    }
};
