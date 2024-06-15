const {
  CheckThread,
  AddMessageToThread,
  CreateRun,
  RunStatusCheckLoop,
  GetResponse,
} = require("../helpers/openai-helpers.js");

const { Events, EmbedBuilder, ChannelType } = require("discord.js");

let winningMember;
let winningMessage;
let winReaction;

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot) return;
    if (message.channel.type === "dm") return;

    const member = message.author;
    const guildMember = message.member;
    const channel = message.channel;
    const channelId = message.channelId;
    const content = message.content;
    const guild = message.guild;

    // console.log(`Message from ${member.user.username} [${member}]: ${content}`)

    // LAST MESSAGE WINS
    // IF LAST MESSAGE WINS CHANNEL
    if (channelId === "1043375542977703976") {
      console.log(`${guildMember.user.username} is the new winner!`);
      if (!!winningMember) {
        //console.log(`Removing winner role from ${guildMember.displayName}`)
        winningMember.roles.remove("1083964151723982969");
      }

      // this doesn't work lets just catch the error for now to prevent crashing
      try {
        // if there was a winning message at some point (if this isnt the first message since bot came online)
        if (winningMessage) {
          // check if the old message still exists
          const oldMessage = await channel.messages.fetch(winningMessage.id);
          if (oldMessage) {
            console.log("Removing old reaction");
            winningMessage.reactions.resolve(winReaction).remove();
          } else {
            console.log("Old winning message no longer exists");
          }
        }

        winningMember = guildMember;
        winningMessage = message;
        //console.log(winningMember, winningMember.roles)
        winningMember.roles.add("1083964151723982969");
        winReaction = await winningMessage.react("🎉");
      } catch (error) {
        console.error("Error setting winner:", error);
      }
    }

    // AI ASSISTANT
    // get the channel id (we are only allowing use in discord threads)
    try {
      if (channel.parentId === "1251345480005193728") {
        const messages = await channel.messages.fetch({ limit: 2 });
        if (
          (messages.size > 1) &
          !message.mentions.users.some(
            (user) => user.id === "1044597619994935307"
          )
        ) {
          console.log("Ignoring message.");
          return;
        }

        // console.log(
        //   `Message sent in gpt-help forum: channel: ${channelId}`
        // );
        // check if the forum post (channelId) exists in the map with an associated thread id
        const threadId = await CheckThread(channelId);
        console.log(threadId);
        // add message to thread
        await AddMessageToThread(threadId, message);
        // create run
        const run = await CreateRun(threadId);
        // get response
        channel.sendTyping();
        const response = await GetResponse(threadId, run.id);
        console.log("Response: ", response.text.annotations);
        message.reply(response.text.value);
      }
    } catch (error) {
      console.error("AI Assistant error:", error);
    }
  },
};
