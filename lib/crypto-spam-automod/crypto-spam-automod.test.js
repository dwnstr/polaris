const test = require("node:test");
const assert = require("node:assert/strict");
const { PermissionFlagsBits } = require("discord.js");
const { ActivityStore } = require("./activity-store");
const {
  isImageAttachment,
  isQualifyingImageMessage,
} = require("./classifier");
const { CryptoSpamAutomod } = require("./index");
const { purgeMessages, timeoutMember } = require("./enforcer");

function attachment(name, contentType) {
  return { name, contentType };
}

function fakeMessage({
  id,
  channelId,
  timestamp,
  content = "",
  attachments = [],
  staff = false,
}) {
  return {
    id,
    channelId,
    guildId: "guild-1",
    createdTimestamp: timestamp,
    content,
    attachments: new Map(attachments.map((item, index) => [index, item])),
    author: { id: "user-1", bot: false, tag: "scammer#0001" },
    member: {
      permissions: {
        has(permission) {
          return staff && permission === PermissionFlagsBits.ManageMessages;
        },
      },
    },
    guild: { id: "guild-1", name: "Test Guild" },
    inGuild: () => true,
  };
}

const twoImages = [
  attachment("one.png", "image/png"),
  attachment("two.unknown", "image/webp"),
];

test("image attachment classification uses MIME type and extension fallback", () => {
  assert.equal(isImageAttachment(attachment("photo.bin", "image/png")), true);
  assert.equal(isImageAttachment(attachment("photo.JPEG", null)), true);
  assert.equal(isImageAttachment(attachment("notes.txt", "text/plain")), false);
});

test("a qualifying message requires empty text and at least two images", () => {
  assert.equal(
    isQualifyingImageMessage(fakeMessage({ id: "1", attachments: twoImages })),
    true
  );
  assert.equal(
    isQualifyingImageMessage(
      fakeMessage({ id: "2", content: "buy now", attachments: twoImages })
    ),
    false
  );
  assert.equal(
    isQualifyingImageMessage(
      fakeMessage({ id: "3", attachments: [twoImages[0]] })
    ),
    false
  );
});

test("activity store expires records, removes empty keys, and enforces caps", () => {
  const store = new ActivityStore({
    historyWindowMs: 100,
    maxPerUser: 2,
    maxTotal: 3,
  });
  const add = (userId, messageId, createdAt) =>
    store.add({ guildId: "g", userId, messageId, channelId: "c", createdAt }, 100);

  add("u1", "1", 90);
  add("u1", "2", 91);
  add("u1", "3", 92);
  assert.deepEqual(store.get("g", "u1").map((item) => item.messageId), ["2", "3"]);

  add("u2", "4", 93);
  add("u3", "5", 94);
  assert.equal(store.totalRecords, 3);
  assert.deepEqual(store.get("g", "u1").map((item) => item.messageId), ["3"]);

  store.cleanup(300);
  assert.equal(store.totalRecords, 0);
  assert.equal(store.recordsByUser.size, 0);
});

test("detector requires qualifying messages in three channels inside two minutes", async () => {
  let now = 1_000_000;
  const enforced = [];
  const reports = [];
  const logs = [];
  const automod = new CryptoSpamAutomod({
    store: new ActivityStore(),
    now: () => now,
    enforce: async (_message, history) => {
      enforced.push(history);
      return {
        timeout: { ok: true, status: "done" },
        purge: { attempted: history.length, deleted: history.length, failed: 0, errors: [] },
      };
    },
    reporter: { send: async (report) => reports.push(report) },
    logger: { info: (line) => logs.push(line), error: () => {} },
  });

  await automod.handleMessage(
    fakeMessage({ id: "ordinary", channelId: "a", timestamp: now, content: "hello" })
  );
  await automod.handleMessage(
    fakeMessage({ id: "image-a", channelId: "a", timestamp: now, attachments: twoImages })
  );
  await automod.handleMessage(
    fakeMessage({ id: "image-a2", channelId: "a", timestamp: now, attachments: twoImages })
  );
  assert.equal(enforced.length, 0);

  now += 1_000;
  await automod.handleMessage(
    fakeMessage({ id: "image-b", channelId: "b", timestamp: now, attachments: twoImages })
  );
  assert.equal(enforced.length, 0);

  now += 1_000;
  await automod.handleMessage(
    fakeMessage({ id: "image-c", channelId: "c", timestamp: now, attachments: twoImages })
  );
  assert.equal(enforced.length, 1);
  assert.deepEqual(enforced[0].map((record) => record.messageId), [
    "ordinary",
    "image-a",
    "image-a2",
    "image-b",
    "image-c",
  ]);
  assert.equal(reports.length, 1);
  assert.match(logs[0], /Triggered guild=guild-1 user=user-1/);
  assert.match(logs[1], /Enforced guild=guild-1 user=user-1 timeout=true deleted=5\/5/);

  now += 121_000;
  await automod.handleMessage(
    fakeMessage({ id: "late-a", channelId: "a", timestamp: now, attachments: twoImages })
  );
  now += 121_000;
  await automod.handleMessage(
    fakeMessage({ id: "late-b", channelId: "b", timestamp: now, attachments: twoImages })
  );
  assert.equal(enforced.length, 1);
});

test("staff are not tracked or enforced", async () => {
  const store = new ActivityStore();
  const automod = new CryptoSpamAutomod({
    store,
    reporter: { send: async () => {} },
    enforce: async () => assert.fail("staff should not be enforced"),
    logger: { info: () => {}, error: () => {} },
  });
  await automod.handleMessage(
    fakeMessage({ id: "staff", channelId: "a", attachments: twoImages, staff: true })
  );
  assert.equal(store.totalRecords, 0);
});

test("enforcement lock prevents duplicate concurrent actions", async () => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let enforcementCount = 0;
  const automod = new CryptoSpamAutomod({
    store: new ActivityStore(),
    reporter: { send: async () => {} },
    logger: { info: () => {}, error: () => {} },
    enforce: async (_message, history) => {
      enforcementCount += 1;
      await gate;
      return {
        timeout: { ok: true, status: "done" },
        purge: { attempted: history.length, deleted: history.length, failed: 0, errors: [] },
      };
    },
  });

  await automod.handleMessage(
    fakeMessage({ id: "1", channelId: "a", attachments: twoImages })
  );
  await automod.handleMessage(
    fakeMessage({ id: "2", channelId: "b", attachments: twoImages })
  );
  const enforcing = automod.handleMessage(
    fakeMessage({ id: "3", channelId: "c", attachments: twoImages })
  );
  await automod.handleMessage(
    fakeMessage({ id: "4", channelId: "d", attachments: twoImages })
  );
  assert.equal(enforcementCount, 1);
  release();
  await enforcing;
});

test("purge uses bulk and individual deletion and survives unavailable channels", async () => {
  const deletedIndividually = [];
  const bulkBatches = [];
  const channelA = {
    id: "a",
    isTextBased: () => true,
    messages: { delete: async (id) => deletedIndividually.push(id) },
    bulkDelete: async (ids) => {
      bulkBatches.push(ids);
      return new Map(ids.map((id) => [id, true]));
    },
  };
  const channelB = {
    id: "b",
    isTextBased: () => true,
    messages: { delete: async (id) => deletedIndividually.push(id) },
    bulkDelete: async () => {
      throw new Error("missing permission");
    },
  };
  const guild = { channels: { cache: new Map([["a", channelA], ["b", channelB]]) } };
  const records = [
    { channelId: "a", messageId: "1" },
    { channelId: "a", messageId: "2" },
    { channelId: "a", messageId: "3" },
    { channelId: "b", messageId: "4" },
    { channelId: "b", messageId: "5" },
    { channelId: "missing", messageId: "6" },
  ];
  const result = await purgeMessages(guild, records);
  assert.deepEqual(bulkBatches, [["1", "2", "3"]]);
  assert.deepEqual(deletedIndividually, ["4", "5"]);
  assert.equal(result.deleted, 5);
  assert.equal(result.failed, 1);
});

test("timeout reports non-moderatable members and API failures", async () => {
  assert.deepEqual(await timeoutMember({ moderatable: false }), {
    ok: false,
    status: "not moderatable",
  });
  const result = await timeoutMember({
    moderatable: true,
    timeout: async () => {
      throw new Error("role hierarchy");
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.status, /role hierarchy/);
});
