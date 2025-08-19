import { Meteor } from "meteor/meteor";
import { Template } from "meteor/templating";
import { ReactiveVar } from "meteor/reactive-var";
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';

import "./friends.html";

Template.friends.onCreated(function () {
  this.usersList = new ReactiveVar([]);
  this.searchResults = new ReactiveVar([]);
  this.friendList = new ReactiveVar([]);
  this.selectedUnfriend = new ReactiveVar(null);

  this.autorun(() => {
    Meteor.call("friendRequests.getAccepted", (error, result) => {
      if (error) {
        console.error("Error fetching accepted friend requests:", error);
      } else {
        this.friendList.set(result);
      }
    })
  })
});

Template.friends.helpers({
  friendList() {
    return Template.instance().friendList.get();
  },

  searchResults() {
    return Template.instance().searchResults.get();
  },

  getUserDisplayName(user) {
    return (
      user.services?.google?.name ||
      user.profile?.name ||
      user.profile?.firstName + " " + user.profile?.lastName ||
      user.username ||
      user.services?.google?.email ||
      (user.emails && user.emails[0]?.address)
    );
  },

  getUserEmail(user) {
    return user.services?.google?.email || (user.emails && user.emails[0]?.address);
  },

  getUserAvatar(user) {
    return user.services?.google?.picture || "/images/default-avatar.png";
  },
  selectedUnfriend() {
    return Template.instance().selectedUnfriend.get();
  }
});

Template.friends.events({
  "submit #searchUser"(event, template) {
    event.preventDefault(); // Ngăn chặn form submit mặc định

    const usernameOrEmail = document.getElementById("usernameOrEmail").value.trim();
    if (!usernameOrEmail) {
      console.error("Please enter a username or email");
      return;
    }

    const templateInstance = template;

    Meteor.call("users.searchByUsernameOrEmailForSendRequest", usernameOrEmail, (error, result) => {
      if (error) {
        console.error("Error searching users:", error);
        console.error("Error searching for users");
        return;
      }

      // Kiểm tra template instance còn tồn tại
      if (templateInstance && templateInstance.searchResults) {
        templateInstance.searchResults.set(result);

        // Đóng modal sau khi có kết quả
        const modalElement = document.getElementById("addFriendModal");
        if (modalElement && typeof bootstrap !== "undefined" && bootstrap.Modal) {
          const modal = bootstrap.Modal.getInstance(modalElement);
          if (modal) {
            modal.hide();
          }
        }
      }
    });
  },

  "click #sendFriendRequest"(event, template) {
    event.preventDefault();

    const form = document.getElementById("searchUser");
    if (form) {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    }
  },
  "click .send-message"(event) {
    event.preventDefault();
    const friendshipId = event.currentTarget.dataset.id;

    Meteor.call("inboxes.findByUserIds", [friendshipId, Meteor.userId()], (error, result) => {
      if (error) {
        console.error("Error finding inbox:", error);
        return;
      }

      FlowRouter.go(`/message/${result._id}`);
    });

  },
  "click .send-request"(event, template) {
    event.preventDefault();
    const userId = event.currentTarget.dataset.userId;

    Meteor.call("friendRequests.insert", userId, (error) => {
      if (error) {
        console.error("Error sending friend request:", error);
      } else {
        const searchResults = template.searchResults.get();
        const updatedResults = searchResults.filter(user => user._id !== userId);
        template.searchResults.set(updatedResults);
      }
    });
  },
  "click #confirmRemoveFriend"(event, template) {
    event.preventDefault();

    const user = template.selectedUnfriend.get();
    if (user) {
      Meteor.call("friendRequests.unfriend", user.friendship._id, (error) => {
        if (error) {
          console.error("Error deleting friend request:", error);
        } else {
          const currentFriendList = template.friendList.get();
          template.friendList.set(currentFriendList.filter(friend => friend.friendshipId !== user.friendshipId));
        }
      });
    }
  },
  "click .unfriend-btn"(event, template) {
    event.preventDefault();
    const id = event.currentTarget.dataset.id;

    const user = template.friendList.get().find(friend => friend.friendshipId === id);
    template.selectedUnfriend.set(user);
  },
  "click .cancelAddFriendModal"(event, template) {
    event.preventDefault();
    template.searchResults.set([]);
    document.getElementById("usernameOrEmail").value = "";
  }
});

Template.friends.onRendered(function () {
  if (typeof bootstrap === "undefined") {
    console.error("Bootstrap is not loaded");
  }
});
