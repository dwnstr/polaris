const { EmbedBuilder, WebhookClient } = require("discord.js");

class ModerationReporter {
  constructor(webhookUrl) {
    this.webhook = new WebhookClient({ url: webhookUrl });
  }

  async send({ message, triggerRecords, result }) {
    const channels = [...new Set(triggerRecords.map((record) => record.channelId))]
      .map((id) => `<#${id}>`)
      .join(", ");
    const errors = result.purge.errors.slice(0, 5).join("\n") || "None";
    const embed = new EmbedBuilder()
      .setColor(result.timeout.ok && result.purge.failed === 0 ? 0xd64545 : 0xe39b32)
      .setTitle("Crypto image spam automatically handled")
      .setDescription(`User: ${message.author.tag} (${message.author.id})`)
      .addFields(
        { name: "Guild", value: `${message.guild.name} (${message.guild.id})` },
        { name: "Trigger channels", value: channels || "Unknown" },
        {
          name: "Messages",
          value: `${result.purge.deleted}/${result.purge.attempted} deleted; ${result.purge.failed} failed`,
        },
        { name: "Timeout", value: result.timeout.status },
        { name: "Deletion errors (up to 5)", value: errors.slice(0, 1024) }
      )
      .setTimestamp();

    await this.webhook.send({
      embeds: [embed],
      allowedMentions: { parse: [] },
    });
  }
}

module.exports = { ModerationReporter };
