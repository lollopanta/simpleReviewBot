const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { getGuildSettings, updateGuildSettings } = require('../utils/guildSettings');
const { createSettingsEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embeds');
const { isAdministrator } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Configure bot settings for this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View current bot settings')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('channel')
                .setDescription('Set a channel')
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Channel type to set')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Staff Review Channel', value: 'staff_review' },
                            { name: 'Reviews Channel', value: 'reviews' },
                            { name: 'Logs Channel', value: 'logs' }
                        )
                )
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The channel to set')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('role')
                .setDescription('Set staff role')
                .addRoleOption(option =>
                    option
                        .setName('role')
                        .setDescription('The staff role')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('feature')
                .setDescription('Toggle a feature')
                .addStringOption(option =>
                    option
                        .setName('feature')
                        .setDescription('Feature to toggle')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Anonymous Reviews', value: 'allowAnonymous' },
                            { name: 'Cooldowns', value: 'enableCooldowns' },
                            { name: 'Auto-Approval', value: 'autoApproval' },
                            { name: 'Review Edits', value: 'allowReviewEdits' }
                        )
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('cooldown')
                .setDescription('Set cooldown duration')
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Cooldown type')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Review Request', value: 'reviewRequest' },
                            { name: 'Review Submission', value: 'reviewSubmission' }
                        )
                )
                .addIntegerOption(option =>
                    option
                        .setName('hours')
                        .setDescription('Cooldown duration in hours')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(168) // Max 1 week
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('panel')
                .setDescription('Open interactive settings panel')
        ),
    
    async execute(interaction) {
        // Check permissions
        if (!isAdministrator(interaction.member)) {
            return interaction.reply({
                embeds: [createErrorEmbed('You must be an administrator to use this command.')],
                ephemeral: true
            });
        }
        
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        
        await interaction.deferReply({ ephemeral: true });
        
        try {
            if (subcommand === 'view') {
                const settings = await getGuildSettings(guildId);
                const embed = createSettingsEmbed(settings);
                return interaction.editReply({ embeds: [embed] });
            }
            
            if (subcommand === 'channel') {
                const type = interaction.options.getString('type');
                const channel = interaction.options.getChannel('channel');
                
                // Validate channel type
                if (!channel.isTextBased()) {
                    return interaction.editReply({
                        embeds: [createErrorEmbed('The channel must be a text channel.')]
                    });
                }
                
                const channelMap = {
                    'staff_review': 'channels.staffReviewChannel',
                    'reviews': 'channels.reviewsChannel',
                    'logs': 'channels.logsChannel'
                };
                
                const updates = {};
                const path = channelMap[type];
                const [parent, key] = path.split('.');
                updates[parent] = { [key]: channel.id };
                
                await updateGuildSettings(guildId, updates, interaction.user.id);
                
                return interaction.editReply({
                    embeds: [createSuccessEmbed(`✅ ${type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} set to ${channel}.`)]
                });
            }
            
            if (subcommand === 'role') {
                const role = interaction.options.getRole('role');
                
                await updateGuildSettings(guildId, {
                    roles: { staffRole: role.id }
                }, interaction.user.id);
                
                return interaction.editReply({
                    embeds: [createSuccessEmbed(`✅ Staff role set to ${role}.`)]
                });
            }
            
            if (subcommand === 'feature') {
                const feature = interaction.options.getString('feature');
                const settings = await getGuildSettings(guildId);
                const currentValue = settings.features[feature];
                
                await updateGuildSettings(guildId, {
                    features: { [feature]: !currentValue }
                }, interaction.user.id);
                
                const featureNames = {
                    allowAnonymous: 'Anonymous Reviews',
                    enableCooldowns: 'Cooldowns',
                    autoApproval: 'Auto-Approval',
                    allowReviewEdits: 'Review Edits'
                };
                
                return interaction.editReply({
                    embeds: [createSuccessEmbed(
                        `✅ ${featureNames[feature]} ${!currentValue ? 'enabled' : 'disabled'}.`
                    )]
                });
            }
            
            if (subcommand === 'cooldown') {
                const type = interaction.options.getString('type');
                const hours = interaction.options.getInteger('hours');
                const milliseconds = hours * 60 * 60 * 1000;
                
                const cooldownMap = {
                    'reviewRequest': 'cooldowns.reviewRequest',
                    'reviewSubmission': 'cooldowns.reviewSubmission'
                };
                
                const updates = {};
                const path = cooldownMap[type];
                const [parent, key] = path.split('.');
                updates[parent] = { [key]: milliseconds };
                
                await updateGuildSettings(guildId, updates, interaction.user.id);
                
                return interaction.editReply({
                    embeds: [createSuccessEmbed(`✅ ${type.replace(/([A-Z])/g, ' $1').trim()} cooldown set to ${hours} hours.`)]
                });
            }
            
            if (subcommand === 'panel') {
                const settings = await getGuildSettings(guildId);
                const embed = createSettingsEmbed(settings);
                
                // Create buttons for quick actions
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`settings_channel_staff_${interaction.user.id}`)
                            .setLabel('Set Staff Channel')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`settings_channel_reviews_${interaction.user.id}`)
                            .setLabel('Set Reviews Channel')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`settings_channel_logs_${interaction.user.id}`)
                            .setLabel('Set Logs Channel')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(`settings_role_${interaction.user.id}`)
                            .setLabel('Set Staff Role')
                            .setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder()
                            .setCustomId(`settings_refresh_${interaction.user.id}`)
                            .setLabel('Refresh')
                            .setStyle(ButtonStyle.Success)
                    );
                
                return interaction.editReply({
                    embeds: [embed],
                    components: [row]
                });
            }
            
        } catch (error) {
            console.error('Error in settings command:', error);
            return interaction.editReply({
                embeds: [createErrorEmbed('An error occurred while updating settings.')]
            });
        }
    }
};
