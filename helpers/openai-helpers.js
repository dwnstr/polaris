const { OPEN_AI_API_KEY, ASSISTANT_ID } = require("../config.json");
const { OpenAI } = require("openai");
const { sleep } = require("./helpers");

const threads = {};
const terminalStates = ["cancelled", "failed", "completed", "expired"];

const openai = new OpenAI({
  apiKey: OPEN_AI_API_KEY,
});

const StatusCheckLoop = async (threadId, runId) => {
  const run = await openai.beta.threads.runs.retrieve(threadId, runId);

  if (!terminalStates.includes(run.status)) {
    console.log("Waiting for run to finish: ", run.status);
    await sleep(1000);
    return StatusCheckLoop(threadId, runId);
  } else {
    return run.status;
  }
};

module.exports = {
  async CheckThread(channelId) {
    if (channelId in threads) {
      // console.log(`Found thread ${threads[channelId]} for ${channelId}`);
      return threads[channelId];
    } else {
      // create thread and insert
      const thread = await openai.beta.threads.create();
      threads[channelId] = thread.id;
      console
        .log
        // `Created assistant thread ${thread.id} for channel ${channelId}`
        ();
      return thread.id;
    }
  },

  // async RunStatusCheckLoop(threadId, runId) {
  //   await StatusCheckLoop(threadId, runId);
  // },

  async AddMessageToThread(threadId, message) {
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message.content,
    });
  },

  async CreateRun(threadId) {
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID,
    });
    return run;
  },

  async GetResponse(threadId, runId) {
    await StatusCheckLoop(threadId, runId);
    console.log(`Run ${runId} completed`);
    const messages = await openai.beta.threads.messages.list(threadId);
    console.log(messages.data[0].content);
    const response = messages.data[0].content[0];

    return response;
  },
};
