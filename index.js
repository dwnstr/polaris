require("dotenv").config();

const fs = require("node:fs");
const path = require("node:path");
const { Client, Collection, GatewayIntentBits } = require("discord.js");
const { createCryptoSpamAutomod } = require("./lib/crypto-spam-automod");

const { createClient } = require("@supabase/supabase-js");

// Pull variables from environment
const token = process.env.token;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const moderationWebhookUrl = process.env.DISCORD_MOD_WEBHOOK_URL;

// Validate required env vars
if (!token) throw new Error("Missing token environment variable");
if (!supabaseUrl) throw new Error("Missing SUPABASE_URL environment variable");
if (!supabaseKey) throw new Error("Missing SUPABASE_KEY environment variable");
if (!moderationWebhookUrl) {
  throw new Error("Missing DISCORD_MOD_WEBHOOK_URL environment variable");
}

global.supabase = createClient(supabaseUrl, supabaseKey);

// Create a new client instance
global.client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();
client.cryptoSpamAutomod = createCryptoSpamAutomod({
  webhookUrl: moderationWebhookUrl,
});
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder);
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));
  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ("data" in command && "execute" in command) {
      client.commands.set(command.data.name, command);
    } else {
      console.log(
        `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
      );
    }
  }
}

const eventsPath = path.join(__dirname, "events");
const eventFiles = fs
  .readdirSync(eventsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of eventFiles) {
  const filePath = path.join(eventsPath, file);
  const event = require(filePath);
  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args));
  } else {
    client.on(event.name, (...args) => event.execute(...args));
  }
}

client.login(token);
