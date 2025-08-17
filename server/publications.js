import { Meteor } from 'meteor/meteor';
import { Inboxes } from '/imports/api/inboxes';
import { Messages } from '/imports/api/messages';
import { Sessions } from '/imports/api/sessions';
import { check } from "meteor/check";

Meteor.publish('sessions', async function (userIds) {
    if (!this.userId) return this.ready();
    check(userIds, Array);
    return Sessions.find({ userId: { $in: userIds } });
});

Meteor.publish('inboxes', function () {
    if (!this.userId) return this.ready();
    return Inboxes.find({ members: this.userId }, { sort: { createdAt: -1 } });
});

Meteor.publish('messages', function (inboxId) {
    if (!this.userId) return this.ready();
    check(inboxId, String);
    return Messages.find({ inboxId }, { sort: { createdAt: -1 } });
});



