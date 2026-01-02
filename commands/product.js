const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Product = require('../models/Product');
const { createProductEmbed, createErrorEmbed, createSuccessEmbed } = require('../utils/embeds');
const { canManageProducts } = require('../utils/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('product')
        .setDescription('Manage products')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a new product')
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('Product name')
                        .setRequired(true)
                        .setMaxLength(100)
                )
                .addStringOption(option =>
                    option
                        .setName('description')
                        .setDescription('Product description')
                        .setMaxLength(500)
                )
                .addNumberOption(option =>
                    option
                        .setName('price')
                        .setDescription('Product price in EUR')
                        .setRequired(true)
                        .setMinValue(0)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit an existing product')
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('Product ID')
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('New product name')
                        .setMaxLength(100)
                )
                .addStringOption(option =>
                    option
                        .setName('description')
                        .setDescription('New product description')
                        .setMaxLength(500)
                )
                .addNumberOption(option =>
                    option
                        .setName('price')
                        .setDescription('New product price in EUR')
                        .setMinValue(0)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a product (soft delete)')
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('Product ID')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all products')
                .addBooleanOption(option =>
                    option
                        .setName('include_inactive')
                        .setDescription('Include inactive products')
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View product details')
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('Product ID')
                        .setRequired(true)
                )
        ),
    
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;
        
        await interaction.deferReply({ ephemeral: subcommand !== 'list' });
        
        // Check permissions for management commands
        if (['add', 'edit', 'delete'].includes(subcommand)) {
            if (!(await canManageProducts(interaction.member, guildId))) {
                return interaction.editReply({
                    embeds: [createErrorEmbed('You do not have permission to manage products.')]
                });
            }
        }
        
        try {
            if (subcommand === 'add') {
                const name = interaction.options.getString('name');
                const description = interaction.options.getString('description') || '';
                const price = interaction.options.getNumber('price');
                
                // Check if product with same name exists
                const existing = await Product.findOne({
                    guildId,
                    name: name,
                    active: true
                });
                
                if (existing) {
                    return interaction.editReply({
                        embeds: [createErrorEmbed('A product with this name already exists.')]
                    });
                }
                
                const product = await Product.create({
                    guildId,
                    name,
                    description,
                    price,
                    createdBy: interaction.user.id
                });
                
                const embed = createProductEmbed(product);
                return interaction.editReply({
                    embeds: [embed, createSuccessEmbed(`Product "${name}" has been created!`)]
                });
            }
            
            if (subcommand === 'edit') {
                const productId = interaction.options.getString('id');
                const name = interaction.options.getString('name');
                const description = interaction.options.getString('description');
                const price = interaction.options.getNumber('price');
                
                const product = await Product.getProduct(productId, guildId);
                
                if (!product) {
                    return interaction.editReply({
                        embeds: [createErrorEmbed('Product not found.')]
                    });
                }
                
                const updates = {};
                if (name) {
                    // Check if another product has this name
                    const existing = await Product.findOne({
                        guildId,
                        name: name,
                        active: true,
                        _id: { $ne: productId }
                    });
                    
                    if (existing) {
                        return interaction.editReply({
                            embeds: [createErrorEmbed('A product with this name already exists.')]
                        });
                    }
                    
                    updates.name = name;
                }
                if (description !== null) updates.description = description;
                if (price !== null) updates.price = price;
                
                Object.assign(product, updates);
                await product.save();
                
                const embed = createProductEmbed(product);
                return interaction.editReply({
                    embeds: [embed, createSuccessEmbed('Product updated successfully!')]
                });
            }
            
            if (subcommand === 'delete') {
                const productId = interaction.options.getString('id');
                
                const product = await Product.getProduct(productId, guildId);
                
                if (!product) {
                    return interaction.editReply({
                        embeds: [createErrorEmbed('Product not found.')]
                    });
                }
                
                // Soft delete
                product.active = false;
                await product.save();
                
                return interaction.editReply({
                    embeds: [createSuccessEmbed(`Product "${product.name}" has been deleted.`)]
                });
            }
            
            if (subcommand === 'list') {
                const includeInactive = interaction.options.getBoolean('include_inactive') || false;
                
                const products = await Product.getGuildProducts(guildId, includeInactive);
                
                if (products.length === 0) {
                    return interaction.editReply({
                        embeds: [createErrorEmbed('No products found.')]
                    });
                }
                
                // Update ratings for all products
                for (const product of products) {
                    await product.updateRatingStats();
                }
                
                // Refresh products after updating stats
                const updatedProducts = await Product.getGuildProducts(guildId, includeInactive);
                
                const productList = updatedProducts.map((product, index) => {
                    const stars = '⭐'.repeat(Math.round(product.averageRating)) + '☆'.repeat(5 - Math.round(product.averageRating));
                    const status = product.active ? '✅' : '❌';
                    return `${status} **${product.name}** - €${product.price.toFixed(2)} - ${product.reviewCount} reviews - ${stars} (${product.averageRating.toFixed(1)}/5)\n\`ID: ${product._id}\``;
                }).join('\n\n');
                
                const embed = new (require('discord.js').EmbedBuilder)()
                    .setTitle('📦 Products')
                    .setDescription(productList.length > 4000 ? productList.substring(0, 4000) + '...' : productList)
                    .setColor(0x5865F2)
                    .setTimestamp();
                
                return interaction.editReply({ embeds: [embed] });
            }
            
            if (subcommand === 'view') {
                const productId = interaction.options.getString('id');
                
                const product = await Product.getProduct(productId, guildId);
                
                if (!product) {
                    return interaction.editReply({
                        embeds: [createErrorEmbed('Product not found.')]
                    });
                }
                
                // Update rating stats
                await product.updateRatingStats();
                
                // Refresh product
                const updatedProduct = await Product.getProduct(productId, guildId);
                
                const embed = createProductEmbed(updatedProduct, updatedProduct.reviewCount, updatedProduct.averageRating);
                return interaction.editReply({ embeds: [embed] });
            }
            
        } catch (error) {
            console.error('Error in product command:', error);
            return interaction.editReply({
                embeds: [createErrorEmbed('An error occurred while processing your request.')]
            });
        }
    }
};
