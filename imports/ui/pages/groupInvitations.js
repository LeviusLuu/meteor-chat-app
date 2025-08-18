import { Meteor } from "meteor/meteor";
import { Template } from "meteor/templating";
import { ReactiveVar } from "meteor/reactive-var";
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';

import "./groupInvitations.html";

Template.groupInvitations.onCreated(function () {
    this.groupInvitationsReceived = new ReactiveVar([]);
    this.groupInvitationsSent = new ReactiveVar([]);

    Meteor.call("groupInvitations.getReceived", (error, result) => {
        if (!error) {
            this.groupInvitationsReceived.set(result);
        }
    });

    Meteor.call("groupInvitations.getSent", (error, result) => {
        if (!error) {
            this.groupInvitationsSent.set(result);
        }
    });
});


Template.groupInvitations.helpers({
    groupInvitationsReceived() {
        return Template.instance().groupInvitationsReceived.get();
    },
    groupInvitationsSent() {
        return Template.instance().groupInvitationsSent.get();
    }
});

Template.groupInvitations.events({
    'click .accept-invitation'(event, template) {
        const invitationId = this._id;
        Meteor.call("groupInvitations.accept", invitationId, (error) => {
            if (error) {
                console.error("Error accepting invitation:", error);
            } else {
                template.groupInvitationsReceived.set(template.groupInvitationsReceived.get().filter(invitation => invitation._id !== invitationId));
            }
        });
    },
    'click .reject-invitation'(event, template) {
        const invitationId = this._id;
        Meteor.call("groupInvitations.remove", invitationId, (error) => {
            if (error) {
                console.error("Error removing invitation:", error);
            } else {
                template.groupInvitationsReceived.set(template.groupInvitationsReceived.get().filter(invitation => invitation._id !== invitationId));
            }
        });
    },
    'click .btn-cancel-invitation'(event, template) {
        const invitationId = event.currentTarget.dataset.id;
        Meteor.call("groupInvitations.remove", invitationId, (error) => {
            if (error) {
                console.error("Error removing invitation:", error);
            } else {
                console.log("Invitation removed successfully");
                template.groupInvitationsSent.set(template.groupInvitationsSent.get().filter(invitation => invitation._id !== invitationId));
            }
        });
    }
})