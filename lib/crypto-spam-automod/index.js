const { PermissionFlagsBits } = require("discord.js");
const config = require("./config");
const { ActivityStore } = require("./activity-store");
const { isQualifyingImageMessage } = require("./classifier");
const { enforce } = require("./enforcer");
const { ModerationReporter } = require("./reporter");

class CryptoSpamAutomod {
  constructor(options) {
    this.store = options.store || new ActivityStore();
    this.reporter = options.reporter;
    this.enforce = options.enforce || enforce;
    this.now = options.now || Date.now;
    this.logger = options.logger || console;
    this.enforcementLocks = new Set();
  }

  isStaff(member) {
    return Boolean(
      member?.permissions?.has(PermissionFlagsBits.Administrator) ||
        member?.permissions?.has(PermissionFlagsBits.ManageMessages)
    );
  }

  async handleMessage(message) {
    if (!message.inGuild() || message.author.bot || this.isStaff(message.member)) return;

    const now = this.now();
    const record = {
      guildId: message.guildId,
      userId: message.author.id,
      channelId: message.channelId,
      messageId: message.id,
      createdAt: message.createdTimestamp || now,
      qualifying: isQualifyingImageMessage(message),
    };
    this.store.add(record, now);

    const detectionCutoff = now - config.DETECTION_WINDOW_MS;
    const triggerRecords = this.store
      .get(message.guildId, message.author.id, detectionCutoff)
      .filter((candidate) => candidate.qualifying);
    const distinctChannels = new Set(
      triggerRecords.map((candidate) => candidate.channelId)
    );

    if (
      triggerRecords.length < config.MIN_QUALIFYING_MESSAGES ||
      distinctChannels.size < config.MIN_DISTINCT_CHANNELS
    ) {
      return;
    }

    const key = ActivityStore.key(message.guildId, message.author.id);
    if (this.enforcementLocks.has(key)) return;
    this.enforcementLocks.add(key);

    try {
      this.logger.info(
        `[crypto-spam-automod] Triggered guild=${message.guildId} user=${message.author.id} qualifyingMessages=${triggerRecords.length} channels=${distinctChannels.size}`
      );
      const history = this.store.get(
        message.guildId,
        message.author.id,
        now - config.HISTORY_WINDOW_MS
      );
      const result = await this.enforce(message, history);
      this.logger.info(
        `[crypto-spam-automod] Enforced guild=${message.guildId} user=${message.author.id} timeout=${result.timeout.ok} deleted=${result.purge.deleted}/${result.purge.attempted} failed=${result.purge.failed}`
      );
      try {
        await this.reporter.send({ message, triggerRecords, result });
      } catch (error) {
        this.logger.error(
          "Failed to send crypto spam moderation report:",
          error.message
        );
      }
    } finally {
      this.store.removeUser(message.guildId, message.author.id);
      this.enforcementLocks.delete(key);
    }
  }
}

function createCryptoSpamAutomod({ webhookUrl }) {
  const store = new ActivityStore();
  const automod = new CryptoSpamAutomod({
    store,
    reporter: new ModerationReporter(webhookUrl),
  });
  const cleanupTimer = setInterval(
    () => store.cleanup(Date.now()),
    config.CLEANUP_INTERVAL_MS
  );
  cleanupTimer.unref();
  return automod;
}

module.exports = { CryptoSpamAutomod, createCryptoSpamAutomod };
