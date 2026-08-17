const config = require("./config");

class ActivityStore {
  constructor(options = {}) {
    this.historyWindowMs = options.historyWindowMs ?? config.HISTORY_WINDOW_MS;
    this.maxPerUser = options.maxPerUser ?? config.MAX_MESSAGES_PER_USER;
    this.maxTotal = options.maxTotal ?? config.MAX_TOTAL_MESSAGES;
    this.cleanupIntervalMs =
      options.cleanupIntervalMs ?? config.CLEANUP_INTERVAL_MS;
    this.recordsByUser = new Map();
    this.totalRecords = 0;
    this.lastCleanupAt = null;
  }

  static key(guildId, userId) {
    return `${guildId}:${userId}`;
  }

  add(record, now = Date.now()) {
    if (
      this.lastCleanupAt === null ||
      now - this.lastCleanupAt >= this.cleanupIntervalMs
    ) {
      this.cleanup(now);
    }
    const key = ActivityStore.key(record.guildId, record.userId);
    const records = this.recordsByUser.get(key) || [];
    records.push(record);
    this.totalRecords += 1;

    while (records.length > this.maxPerUser) {
      records.shift();
      this.totalRecords -= 1;
    }

    this.recordsByUser.set(key, records);
    this.enforceGlobalCap();
  }

  get(guildId, userId, since = 0) {
    const records = this.recordsByUser.get(ActivityStore.key(guildId, userId));
    return records ? records.filter((record) => record.createdAt >= since) : [];
  }

  removeUser(guildId, userId) {
    const key = ActivityStore.key(guildId, userId);
    const records = this.recordsByUser.get(key);
    if (!records) return;
    this.totalRecords -= records.length;
    this.recordsByUser.delete(key);
  }

  cleanup(now = Date.now()) {
    const cutoff = now - this.historyWindowMs;
    for (const [key, records] of this.recordsByUser) {
      const retained = records.filter((record) => record.createdAt >= cutoff);
      this.totalRecords -= records.length - retained.length;
      if (retained.length === 0) this.recordsByUser.delete(key);
      else this.recordsByUser.set(key, retained);
    }
    this.lastCleanupAt = now;
  }

  enforceGlobalCap() {
    while (this.totalRecords > this.maxTotal) {
      let oldestKey;
      let oldestTimestamp = Infinity;
      for (const [key, records] of this.recordsByUser) {
        if (records[0].createdAt < oldestTimestamp) {
          oldestKey = key;
          oldestTimestamp = records[0].createdAt;
        }
      }
      if (!oldestKey) break;
      const records = this.recordsByUser.get(oldestKey);
      records.shift();
      this.totalRecords -= 1;
      if (records.length === 0) this.recordsByUser.delete(oldestKey);
    }
  }
}

module.exports = { ActivityStore };
