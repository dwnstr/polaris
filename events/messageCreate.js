const { Events, EmbedBuilder } = require("discord.js");

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

    // console.log(`Message from ${imember.user.username} [${member}]: ${content}`)

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
      } catch (error) {
        console.error(error);
      }

      winningMember = guildMember;
      winningMessage = message;
      //console.log(winningMember, winningMember.roles)
      winningMember.roles.add("1083964151723982969");
      winReaction = await winningMessage.react("🎉");
    }
  },
};
