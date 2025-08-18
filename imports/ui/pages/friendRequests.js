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
                console.error('Lỗi khi lấy yêu cầu kết bạn:', error);
            } else {
                this.friendRequestsReceived.set(result);
            }
        });
        Meteor.call('friendRequests.getRequested', (error, result) => {
            if (error) {
                console.log('Lỗi khi lấy yêu cầu kết bạn đã gửi:', error);
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
                console.error("Lỗi khi từ chối yêu cầu kết bạn:", error);
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
                console.error("Lỗi khi chấp nhận yêu cầu kết bạn:", error);
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
                console.error("Lỗi khi hủy yêu cầu kết bạn:", error);
            } else {
                instance.friendRequestsSent.set(
                    instance.friendRequestsSent.get().filter(req => req._id !== requestId)
                );
            }
        });
    }
});
