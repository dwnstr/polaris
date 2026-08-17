const config = require("./config");

async function timeoutMember(member) {
  if (!member?.moderatable) return { ok: false, status: "not moderatable" };
  try {
    await member.timeout(
      config.TIMEOUT_DURATION_MS,
      "Automated action: cross-channel image spam"
    );
    return { ok: true, status: "24-hour timeout applied" };
  } catch (error) {
    return { ok: false, status: `failed: ${error.message}` };
  }
}

async function deleteIndividually(channel, ids, result) {
  for (const id of ids) {
    try {
      await channel.messages.delete(id);
      result.deleted += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push(`${channel.id}/${id}: ${error.message}`);
    }
  }
}

async function deleteChunk(channel, ids, result) {
  if (ids.length === 1) {
    await deleteIndividually(channel, ids, result);
    return;
  }

  try {
    const deleted = await channel.bulkDelete(ids, true);
    result.deleted += deleted.size;
    result.failed += ids.length - deleted.size;
  } catch (error) {
    result.errors.push(`${channel.id} bulk delete: ${error.message}`);
    await deleteIndividually(channel, ids, result);
  }
}

async function purgeMessages(guild, records) {
  const result = { attempted: records.length, deleted: 0, failed: 0, errors: [] };
  const byChannel = new Map();

  for (const record of records) {
    const ids = byChannel.get(record.channelId) || [];
    ids.push(record.messageId);
    byChannel.set(record.channelId, ids);
  }

  for (const [channelId, ids] of byChannel) {
    const channel = guild.channels.cache.get(channelId);
    if (!channel?.isTextBased() || !channel.messages) {
      result.failed += ids.length;
      result.errors.push(`${channelId}: channel unavailable`);
      continue;
    }
    for (let index = 0; index < ids.length; index += 100) {
      await deleteChunk(channel, ids.slice(index, index + 100), result);
    }
  }

  return result;
}

async function enforce(message, records) {
  const timeout = await timeoutMember(message.member);
  const purge = await purgeMessages(message.guild, records);
  return { timeout, purge };
}

module.exports = { enforce, purgeMessages, timeoutMember };
