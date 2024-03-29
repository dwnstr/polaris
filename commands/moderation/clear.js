const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Clears a specified number of messages")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption((option) =>
      option
        .setName("number")
        .setDescription("Number of messages to clear")
        .setRequired(true)
    ),
  async execute(interaction) {
    const clearChannel = interaction.channel;
    const options = interaction.options;
    const number = options.getInteger("number");
    console.log(
      `${interaction.member.user.username} running /clear on ${number} messages.`
    );

    const messagesToDelete = await clearChannel.messages.fetch({
      limit: number + 1,
    });

    //console.log(messagesToDelete)

    const embed = new EmbedBuilder().setColor("#616AA2");

    await clearChannel
      .bulkDelete(number, true)
      .then((messagesToDelete) => {
        embed.setDescription(
          `${messagesToDelete.size} messages have been cleared`
        );
        interaction.reply({ embeds: [embed], ephemeral: true });
      })
      .catch((error) => {
        console.log(error);
        return interaction.reply({
          content: `Something went wrong :(`,
          ephemeral: true,
        });
      });
  },
};
