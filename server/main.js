import { Meteor } from "meteor/meteor";
import { Accounts } from "meteor/accounts-base";
import "/imports/api/inboxes";
import "/imports/api/messages";
import "/imports/api/friendRequests";
import "./methods";
import "./publications";
import { Sessions } from "/imports/api/sessions";
import { ensureBot, initializeBot } from '/imports/startup/server/bot.js';

Meteor.startup(() => {
  ensureBot();
  initializeBot(Meteor.settings.boot.expression, Meteor.settings.boot.content);
});

Meteor.onConnection(conn => {
  conn.onClose(async () => {
    try {
      const offlineUser = await Sessions.findOneAsync({ "connectionId": conn.id });
      if (offlineUser) {
        await Sessions.updateAsync({ userId: offlineUser.userId }, {
          $set: { "online": false, "lastActivity": new Date() },
          $unset: { "connectionId": "" }
        }, { upsert: true });
      }
    } catch (error) {
      console.error("Error in onClose handler:", error);
    }
  });
});

Accounts.onLogin(async info => {
  const connectionId = info.connection && info.connection.id;
  const userId = info.user._id;

  await Sessions.updateAsync(
    { userId },
    {
      $set: {
        connectionId: connectionId || null,
        online: true,
        lastActivity: new Date(),
        lastLogin: new Date()
      },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );
});


