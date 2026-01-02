const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const config = require('./config/config');

// Create Discord client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Initialize command collection
client.commands = new Collection();

/**
 * Load commands from commands directory
 */
function loadCommands() {
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`✅ Loaded command: ${command.data.name}`);
        } else {
            console.warn(`⚠️  Command at ${filePath} is missing required "data" or "execute" property.`);
        }
    }
}

/**
 * Load event handlers from events directory
 */
function loadEvents() {
    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    
    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);
        
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
        
        console.log(`✅ Loaded event: ${event.name}`);
    }
}

/**
 * Register slash commands with Discord
 */
async function registerCommands() {
    const commands = [];
    
    // Get all command data
    for (const [name, command] of client.commands) {
        commands.push(command.data.toJSON());
    }
    
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    
    try {
        console.log('🔄 Started refreshing application (/) commands.');
        
        // Register commands globally
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        
        console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
}

/**
 * Connect to MongoDB
 */
async function connectDatabase() {
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
        console.error('❌ MongoDB URI not provided in environment variables.');
        process.exit(1);
    }
    
    try {
        await mongoose.connect(mongoURI);
        console.log('✅ Connected to MongoDB.');
    } catch (error) {
        console.error('❌ Error connecting to MongoDB:', error);
        process.exit(1);
    }
}

// All event handlers are loaded from the events directory

// Error handling
client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

// Initialize bot
async function init() {
    // Load commands and events
    loadCommands();
    loadEvents();
    
    // Connect to database
    await connectDatabase();
    
    // Register commands
    await registerCommands();
    
    // Login to Discord
    const token = process.env.BOT_TOKEN;
    if (!token) {
        console.error('❌ Bot token not provided in environment variables.');
        process.exit(1);
    }
    
    await client.login(token);
}

// Start the bot
init().catch(console.error);
