import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { ReactiveVar } from 'meteor/reactive-var';
import './friendRequests.html';

Template.friendRequests.onCreated(function () {
    this.friendRequestsReceived = new ReactiveVar([]);
    this.friendRequestsSent = new ReactiveVar([]);

    this.autorun(() => {
        Meteor.call('friendRequests.getReceived', (error, result) => {
            if (error) {
                console.error('Error fetching received friend requests:', error);
            } else {
                this.friendRequestsReceived.set(result);
            }
        });
        Meteor.call('friendRequests.getRequested', (error, result) => {
            if (error) {
                console.log('Error fetching sent friend requests:', error);
            } else {
                this.friendRequestsSent.set(result);
            }
        });
    });
});

Template.friendRequests.helpers({
    friendRequestsReceived() {
        return Template.instance().friendRequestsReceived.get();
    },
    friendRequestsSent() {
        return Template.instance().friendRequestsSent.get();
    }
});

Template.friendRequests.events({
    "click .reject-friend-request"(event, instance) {
        const requestId = event.currentTarget.dataset.requestId;
        Meteor.call("friendRequests.delete", requestId, (error, result) => {
            if (error) {
                console.error("Error rejecting friend request:", error);
            } else {
                instance.friendRequestsReceived.set(
                    instance.friendRequestsReceived.get().filter(req => req._id !== requestId)
                );
            }
        });
    },

    "click .accept-friend-request"(event, instance) {
        const requestId = event.currentTarget.dataset.requestId;
        Meteor.call("friendRequests.accept", requestId, (error, result) => {
            if (error) {
                console.error("Error accepting friend request:", error);
            } else {
                instance.friendRequestsReceived.set(
                    instance.friendRequestsReceived.get().filter(req => req._id !== requestId)
                );
            }
        });
    },

    "click .btn-cancel-request"(event, instance) {
        const requestId = event.currentTarget.dataset.id;
        Meteor.call("friendRequests.delete", requestId, (error, result) => {
            if (error) {
                console.error("Error cancelling friend request:", error);
            } else {
                instance.friendRequestsSent.set(
                    instance.friendRequestsSent.get().filter(req => req._id !== requestId)
                );
            }
        });
    }
});
