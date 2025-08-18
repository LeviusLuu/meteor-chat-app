import { Meteor } from "meteor/meteor";
import { Template } from "meteor/templating";
import { FlowRouter } from "meteor/ostrio:flow-router-extra";
import { ReactiveVar } from "meteor/reactive-var";
import { Messages } from "/imports/api/messages";
import { Sessions } from "/imports/api/sessions";
import moment from "moment";

import "./conversation.html";
import "./conversation.css";

Template.conversation.onCreated(function () {
  this.currentInboxId = new ReactiveVar(null);
  this.messages = new ReactiveVar([]);
  this.headerInfo = new ReactiveVar(null);
  this.userId = new ReactiveVar(null);
  this.isShowInfo = new ReactiveVar(true);
  this.isEditingGroupName = new ReactiveVar(false);
  this.members = new ReactiveVar([]);
  this.leader = new ReactiveVar(null);
  this.searchResults = new ReactiveVar([]);
  this.inviteList = new ReactiveVar([]);

  this.autorun(() => {
    const currentInboxId = FlowRouter.getParam("id");
    this.currentInboxId.set(currentInboxId);

    if (currentInboxId) {
      this.subscribe("messages", currentInboxId);

      Meteor.call(
        "messages.mapDataForMessage",
        Messages.find({ inboxId: currentInboxId }, { sort: { createdAt: -1 } }).fetch(),
        (error, result) => {
          if (error) {
            console.error("Error fetching messages:", error);
          } else {
            this.messages.set(result);
          }
        }
      );

      Meteor.call("inboxes.getHeaderInfo", currentInboxId, (error, result) => {
        if (error) {
          console.error("Error fetching inbox header info:", error);
        } else {
          if (!result) {
            return FlowRouter.go("/message");
          }
          if (result.type == "group") {
            const leader = result.members.find((member) => member._id === result.groupLeader);
            const members = result.members.filter((member) => member._id !== result.groupLeader);
            this.leader.set(leader);
            this.members.set(members);
            this.headerInfo.set({ ...result, members: [leader, ...members] });
          } else {
            this.headerInfo.set(result);
          }

          if (result._id) {
            this.userId.set(result._id);
            this.subscribe("sessions", [result._id]);
          }
        }
      });
    }
  });
});

Template.conversation.helpers({
  isLeader(userId) {
    userId = userId || Meteor.userId();
    return Template.instance().leader.get()?._id === userId;
  },
  isShowInfo() {
    return Template.instance().isShowInfo.get();
  },
  isGroup(type) {
    return type === "group";
  },
  headerInfo() {
    return Template.instance().headerInfo.get();
  },
  messages() {
    return Template.instance().messages.get();
  },
  isSystemMessage(message) {
    return message.isSystem;
  },
  isUserMessage(message) {
    return message?.senderId !== Meteor.userId();
  },
  isUserOnline() {
    const userId = Template.instance().userId.get();

    if (!userId) return "Offline";

    const session = Sessions.findOne({ userId: userId });

    if (!session) return "Offline";
    if (session.online) {
      return "Active now";
    }
    return `Active ${moment(session.lastActivity).fromNow()}`;
  },
  isEditingGroupName() {
    return Template.instance().isEditingGroupName.get();
  },
  isMemberOnline(userId) {
    if (!userId) return false;
    const session = Sessions.findOne({ userId: userId });
    return session?.online === true;
  },
  isYou(userId) {
    return userId === Meteor.userId();
  },
  members() {
    return Template.instance().members.get();
  },
  leader() {
    return Template.instance().leader.get();
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
  inviteList() {
    return Template.instance().inviteList.get();
  },
});

Template.conversation.events({
  "click #send-message": function (event, template) {
    event.preventDefault();

    const messageInput = template.$("#message-input");
    const content = messageInput.val().trim();
    const inboxId = template.currentInboxId.get();

    if (!content) {
      return;
    }

    Meteor.call("messages.insert", inboxId, content, (error, result) => {
      if (error) {
        console.error("Lỗi khi gửi tin nhắn:", error);
      } else {
        messageInput.val("");
      }
    });
  },
  "click #toggle-info": function (event, template) {
    event.preventDefault();
    template.isShowInfo.set(!template.isShowInfo.get());
  },
  "click #edit-group-name": function (event, template) {
    event.preventDefault();
    template.isEditingGroupName.set(!template.isEditingGroupName.get());
  },
  "click #cancel-edit-group-name": function (event, template) {
    event.preventDefault();
    template.isEditingGroupName.set(false);
  },
  "click #save-group-name": function (event, template) {
    event.preventDefault();
    const newGroupName = template.$("#group-name-input").val().trim();
    Meteor.call("groups.updateGroupName", template.currentInboxId.get(), newGroupName, (error, result) => {
      if (error) {
        console.error("Error updating group name:", error);
      } else {
        if (result) {
          template.isEditingGroupName.set(false);
          template.headerInfo.set({
            ...template.headerInfo.get(),
            groupName: newGroupName,
          });
        } else {
          alert(result.message || "Failed to update group name");
        }
      }
    });
  },
  "click #leave-group-btn"(event, template) {
    event.preventDefault();
    const groupId = event.currentTarget.getAttribute("data-id");
    const group = template.groupsList.get().find((group) => group._id === groupId);
    template.selectedLeaveGroup.set(group);
  },
  "click #confirmLeaveGroup"(event, template) {
    event.preventDefault();
    const groupId = template.currentInboxId.get();
    Meteor.call("groups.leaveGroup", groupId, (error, result) => {
      if (error) {
        alert("Error: " + error.message);
      } else {
        if (result.result) {
          let headerInfo = template.headerInfo.get();
          headerInfo.members = headerInfo.members.filter((member) => member._id !== Meteor.userId());
          template.headerInfo.set(headerInfo);
          FlowRouter.go("/message");
        } else {
          alert(result.message);
        }
      }
    });
  },
  "click #confirmDisbandGroup"(event, template) {
    event.preventDefault();
    const groupId = template.currentInboxId.get();
    Meteor.call("groups.disbandGroup", groupId, (error, result) => {
      if (error) {
        console.log("Error: " + error.message);
      } else {
        if (result.result) {
          FlowRouter.go("/message");
        } else {
          alert(result.message);
        }
      }
    });
  },
  "click #confirmChangeGroupLeader"(event, template) {
    event.preventDefault();
    const groupId = template.currentInboxId.get();
    const userId = document.getElementById("newGroupLeader").value.trim();

    Meteor.call("groups.changeLeader", groupId, userId, (error, result) => {
      if (error) {
        alert("Error: " + error.message);
      } else {
        if (result.result) {
          const members = template.members.get();
          const newLeader = members.find((member) => member._id === userId);
          template.leader.set(newLeader);

          const newMembers = members.filter((member) => member._id !== userId);
          template.members.set(newMembers);
        } else {
          alert(result.message);
        }
      }
    });
  },
  "click #searchUser"(event, template) {
    event.preventDefault();
    const usernameOrEmail = document.getElementById("usernameOrEmail").value.trim();
    if (!usernameOrEmail) {
      template.searchResults.set([]);
      return;
    }

    Meteor.call("friendRequests.findFriends", usernameOrEmail, (error, result) => {
      if (error) {
        alert("Error: " + error.message);
      } else {
        const members = template.members.get();
        result = result.filter((user) => !members.find((member) => member._id === user._id));
        template.searchResults.set(result);
      }
    });
  },
  "click .invite-to-group"(event, template) {
    event.preventDefault();
    const userId = event.currentTarget.getAttribute("data-user-id");
    const inviteList = template.inviteList.get();
    const user = template.searchResults.get().find(user => user._id === userId);
    inviteList.push(user);
    template.inviteList.set(inviteList);
    const searchResults = template.searchResults.get();
    template.searchResults.set(searchResults.filter(user => user._id !== userId));
  },
  "click .icon-remove-member"(event, template) {
    event.preventDefault();
    const userId = event.currentTarget.getAttribute("data-user-id");

    const inviteList = template.inviteList.get();
    const updatedInviteList = inviteList.filter(user => user._id !== userId);
    template.inviteList.set(updatedInviteList);

    template.searchResults.set([...template.searchResults.get(), inviteList.find(user => user._id === userId)]);
  },
  "click #confirmInvite"(event, template) {
    const members = template.inviteList.get();
    Meteor.call("groupInvitations.addMany", template.currentInboxId.get(), members, (error, result) => {
      if (error) {
        alert("Error: " + error.message);
      }
      if (result) {
        try {
          $('#inviteModal').modal('hide');
          $('.modal-backdrop').remove();
          $('body').removeClass('modal-open');
        } catch (e) {
          console.error("Error closing modal:", e);
        }
      }
    });
  },
  "click #cancel-invite-btn"(event, template) {
    event.preventDefault();
    template.inviteList.set([]);
    template.searchResults.set([]);
    document.getElementById("usernameOrEmail").value = "";
  }

});

Template.conversation.onRendered(function () {
  this.autorun(() => {
    if (this.messages.get()) {
      Meteor.setTimeout(() => {
        const messageContainer = document.querySelector(".message-container");
        if (messageContainer) {
          messageContainer.scrollTop = messageContainer.scrollHeight;
        }
      }, 100);
    }
  });

  // Auto-resize textarea when typing
  function setupTextareaAutoResize() {
    const textarea = document.querySelector(".conversation-footer > textarea");

    if (textarea) {
      // Function to resize textarea based on content
      function resizeTextarea() {
        // Nếu textarea rỗng, đặt lại kích thước ban đầu và thoát
        if (!textarea.value.trim()) {
          textarea.style.height = "40px";
          textarea.style.overflowY = "hidden";
          return;
        }

        // Reset height to calculate scroll height properly
        textarea.style.height = "40px";

        // Calculate new height based on content
        const newHeight = Math.min(textarea.scrollHeight, 120);
        textarea.style.height = newHeight + "px";

        // Chỉ hiển thị scrollbar khi có nhiều hơn 1 dòng
        if (textarea.scrollHeight <= 40) {
          textarea.style.overflowY = "hidden";
        } else {
          textarea.style.overflowY = "auto";
        }
      }

      // Add event listeners
      textarea.addEventListener("input", resizeTextarea);
      textarea.addEventListener("focus", resizeTextarea);

      // Add Enter key handling to send message
      textarea.addEventListener("keydown", (event) => {
        // Send message on Enter key (without Shift key)
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault(); // Prevent default Enter behavior (new line)
          document.querySelector("#send-message").click(); // Trigger the send button click
        }
      });

      // Initial resize
      resizeTextarea();
    }
  }

  setupTextareaAutoResize();
});
