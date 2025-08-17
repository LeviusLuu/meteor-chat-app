import { Meteor } from "meteor/meteor";
import { Template } from "meteor/templating";
import { ReactiveVar } from "meteor/reactive-var";
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import moment from "moment";

import { Sessions } from "/imports/api/sessions";
import { Inboxes } from '/imports/api/inboxes';
import './home.html';
import './home.css'

Template.home.onCreated(function () {
  this.subscribe('inboxes');
  this.inboxes = new ReactiveVar([])

  this.currentInbox = new ReactiveVar(null);

  this.autorun(() => {
    const currentInbox = FlowRouter.getParam("id");
    this.currentInbox.set(currentInbox);

    const inboxes = Inboxes.find({ members: Meteor.userId() }, { sort: { createdAt: -1 } }).fetch();
    const userIds = inboxes.map(inbox => inbox.members.find(member => member !== Meteor.userId()));
    this.subscribe('sessions', userIds);

    Meteor.call("inboxes.mapLastMessage", inboxes, (error, result) => {
      if (error) {
        console.error("Error fetching last messages:", error);
      } else {
        this.inboxes.set(result);
      }
    })
  });
});

Template.home.helpers({
  isGroup(inbox) {
    return inbox?.type === "group";
  },
  inboxes() {
    return Template.instance().inboxes.get();
  },
  isActive(userId) {
    if (!userId) return false;
    const session = Sessions.findOne({ userId: userId });
    return session?.online === true;
  },
  isSelectedInbox(inboxId) {
    const currentInbox = Template.instance().currentInbox.get();
    if (currentInbox === inboxId) {
      return "inbox-item-active";
    }
    return "";
  },
  renderLastMessage(lastMessage, username) {
    if (lastMessage?.isSystem && lastMessage?.type == "friend_request_accepted") {
      return `You are now friends with ${username}`;
    }
    return lastMessage?.content;
  },
  timeHuman(createdAt) {
    let result = moment(createdAt).fromNow();
    result = result.replace(" minutes", "m");
    result = result.replace(" seconds", "s");
    result = result.replace(" hours", "h");
    result = result.replace(" days", "d");
    result = result.replace(" weeks", "w");
    result = result.replace(" months", "M");
    result = result.replace(" years", "Y");
    return result;
  },
  isMessagePage() {
    const currentPath = FlowRouter.current().path;
    if (currentPath.startsWith("/message/")) {
      const id = currentPath.substring("/message/".length);
      return id.length > 0;
    }
    return false;
  }
});

Template.home.events({
  "click .inbox-item"(event) {
    const inboxId = event.currentTarget.dataset.id;
    FlowRouter.go(`/message/${inboxId}`);
  }
});

Template.home.onRendered(function () {

});

