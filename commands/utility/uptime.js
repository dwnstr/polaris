const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("uptime")
    .setDescription("Displays time since bot last started"),
  async execute(interaction) {
    console.log(`${interaction.imember.user.username} running /uptime.`);
    //console.log(client.uptime)
    const uptime = client.uptime;
    // const uptime = interaction.client.uptime();
    const days = Math.floor(uptime / 86400000);
    const hours = Math.floor(uptime / 3600000) % 24;
    const min = Math.floor(uptime / 60000) % 60;
    const sec = Math.floor(uptime / 1000) % 60;

    const embed = new EmbedBuilder()
      .setTitle("Bot Uptime")
      .setDescription(
        `\`${days}\` Days, \`${hours}\` Hours, \`${min}\` Minutes, \`${sec}\` Seconds,`
      )
      .setColor("#616AA2");

    await interaction.reply({ embeds: [embed] });
  },
};
