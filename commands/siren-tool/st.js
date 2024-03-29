const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { createClient } = require("@supabase/supabase-js");
const { request } = require("undici");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("st")
    .setDescription("Access various Siren Tool related functions.")
    .addUserOption((option) =>
      option
        .setName("target")
        .setDescription("Optional user to target.")
        .setRequired(false)
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("role")
        .setDescription("Claim ST Owner role based on linked accounts.")
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName("update")
        .setDescription("Instructions for updating Siren Tool")
    ),
  async execute(interaction) {
    const target = interaction.options.getUser("target");
    const user = interaction.member.user;
    if (interaction.subcommandName === "role") {
      // check if there is at least one row in sirenToolOwners with discord_id matching user.id
      const { data, error } = await supabase
        .from("sirenToolOwners")
        .select("*")
        .eq("discord_id", user.id)
        .limit(1);

      if (error) {
        console.error(error);
        return interaction.reply({
          content: `Error fetching data: ${error.message}`,
          ephemeral: true,
        });
      }

      if (data.length === 0) {
        // if there is no row in sirenToolOwners with discord_id matching user.id
        return interaction.reply({
          content: `You do not have a Siren Tool account linked to your Discord account.`,
          ephemeral: true,
        });
      }

      return interaction.member.roles
        .add("603592216266539018")
        .then((member) =>
          interaction.reply({
            content: `Successfully claimed ST Owner role! ${member}`,
            ephemeral: true,
          })
        )
        .catch((error) => {
          console.log(error);
          return interaction.reply({
            content: `Something went wrong :( ${member}`,
            ephemeral: true,
          });
        });
    } else if (interaction.subcommandName === "update") {
      console.log("Fetching Siren Tool metadata...");

      const sirenToolMetaResult = await request(
        "https://www.dwnstr.com/api/v2/st/meta?pw=dwnstr24"
      );

      const stMetadata = await sirenToolMetaResult.body.json();

      // make an embed
      const embed = new EmbedBuilder()
        .setAuthor({
          name: "Dawnstar Support",
          iconURL: interaction.guild.iconURL(),
        })
        .setColor("#616AA2")
        .setDescription(
          "**How to Update:**\n\n1. If you wish to migrate your old saves, make a backup of them. They can be found at ``SirenTool/Saved/SaveGames`` don't backup ``user_info.sav``.\n\n2. Download the new version from the link below\n\n3. Follow the readme to extract the files\n\n4. You may not need to re-enter your code, if you do you can go to https://dwnstr.com and login to view and manage your Siren Tool licenses.\n\n5. If you backed up your old saves, place them in ``C:/Users/YOURUSER/AppData/Local/SirenTool/Saved/SaveGames``\n\n6. Enjoy and share with your friends!"
        )
        .addFields({
          name: "Download Link",
          // would be nice to get this from api meta stuff
          value: stMetadata.downloadUrl || "no_link_available",
        })
        .setFooter({ text: "Dawnstar" });
      // send the embed
      await interaction.reply({
        embeds: [embed],
        ephemeral: target && target.id !== user.id,
      });
    }
  },
};
