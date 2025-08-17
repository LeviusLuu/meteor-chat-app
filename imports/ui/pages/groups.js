import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';

import './groups.html';
import './groups.css';

Template.groups.onCreated(function () {
    this.groupsList = new ReactiveVar([]);
    this.searchResults = new ReactiveVar([]);
    this.members = new ReactiveVar([]);

    this.autorun(() => {
        Meteor.call("groups.getList", (error, result) => {
            if (error) {
                console.error("Error fetching groups list:", error);
            } else {
                this.groupsList.set(result);
            }
        })

    });
})

Template.groups.helpers({
    groupList() {
        return Template.instance().groupsList.get();
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
    members() {
        return Template.instance().members.get();
    }
});

Template.groups.events({
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
                result = result.filter(user => !members.find(member => member._id === user._id));
                template.searchResults.set(result);
            }
        });
    },
    "click #add-to-group"(event, template) {
        event.preventDefault();
        const userId = event.currentTarget.getAttribute("data-user-id");

        const user = template.searchResults.get().find(user => user._id === userId);
        const members = template.members.get();
        members.push(user);
        template.members.set(members);

        template.searchResults.set(template.searchResults.get().filter(user => user._id !== userId));
    },
    "click .icon-remove-member"(event, template) {
        event.preventDefault();
        const userId = event.currentTarget.getAttribute("data-user-id");

        const members = template.members.get();
        const updatedMembers = members.filter(user => user._id !== userId);
        template.members.set(updatedMembers);

        template.searchResults.set([...template.searchResults.get(), members.find(user => user._id === userId)]);
    },

    "click #btn-create-group"(event, template) {
        event.preventDefault();
        const groupName = document.getElementById("groupName").value.trim();

        if (!groupName) {
            alert("Please enter a group name");
            return;
        }

        const members = template.members.get().map(user => user._id);
        if (members.length < 2) {
            alert("Please add at least 2 members to create a group");
            return;
        }
        Meteor.call("inboxes.insertGroup", [...members, Meteor.userId()], groupName, (error, result) => {
            if (error) {
                alert("Error: " + error.message);
            } else {
                template.members.set([]);
                template.searchResults.set([]);
                document.getElementById("groupName").value = "";
                const groupsList = template.groupsList.get();
                groupsList.push(result);
                template.groupsList.set(groupsList);

                try {
                    $('#addGroupModal').modal('hide');
                    $('.modal-backdrop').remove();
                    $('body').removeClass('modal-open');
                } catch (e) {
                    console.error("Error closing modal:", e);
                }
            }
        })
    },
    "click .send-message"(event, template) {
        event.preventDefault();
        const groupId = event.currentTarget.getAttribute("data-id");
        FlowRouter.go(`/message/${groupId}`);
    },
    "click .cancelCreateGroupModal"(event, template) {
        event.preventDefault();
        template.members.set([]);
        template.searchResults.set([]);
        document.getElementById("groupName").value = "";
        document.getElementById("usernameOrEmail").value = "";
    }
});
