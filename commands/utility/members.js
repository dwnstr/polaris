const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("members")
    .setDescription("Provides server member count"),
  async execute(interaction) {
    // interaction.guild is the object representing the Guild in which the command was run
    console.log(`${interaction.member.displayName} running /members.`);
    await interaction.reply(
      `${interaction.guild.name} has ${interaction.guild.memberCount} members.`
    );
  },
};
