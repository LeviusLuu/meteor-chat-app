import cron from "node-cron";
import { Meteor } from "meteor/meteor";
import { Messages } from "/imports/api/messages";
import { Inboxes } from "/imports/api/inboxes";

async function ensureBot() {
  const bot = await Meteor.users.updateAsync(
    { isSystem: true },
    {
      $set: {
        services: {
          google: {
            name: Meteor.settings.boot.name,
            email: "bot@gmail.com",
            picture: Meteor.settings.boot.picture,
          },
        },
        profile: {
          name: Meteor.settings.boot.name,
        },
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
  return bot;
}

async function ensureInbox(userId, botId) {
  const existingInbox = await Inboxes.findOneAsync({
    members: { $all: [userId, botId] },
  });

  if (!existingInbox) {
    return Inboxes.insertAsync({
      type: "private",
      members: [userId, botId],
      createdAt: new Date(),
    });
  }

  return existingInbox._id;
}

export async function initializeBot(expression = "0 3 * * *", content = "Hello! I'm your friendly neighborhood chatbot.") {
  cron.schedule(expression, async () => {
    await ensureBot();
    const bot = await Meteor.users.findOneAsync({ isSystem: true });
    const users = await Meteor.users.find({ _id: { $ne: bot._id } }).fetchAsync();

    users.forEach(async (user) => {
      await ensureInbox(user._id, bot._id);
      const inbox = await Inboxes.findOneAsync({ members: { $all: [user._id, bot._id] } });
      if (inbox) {
        await Messages.insertAsync({
          inboxId: inbox._id,
          content: content,
          createdAt: new Date(),
        });
      }
    });
  });
}
