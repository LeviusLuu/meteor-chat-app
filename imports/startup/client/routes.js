import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { Meteor } from 'meteor/meteor';

import '/imports/ui/layouts/mainLayout.html';
import '/imports/ui/pages/home.html';
import '/imports/ui/pages/login.html';
import '/imports/ui/pages/friends.html';
import '/imports/ui/pages/groups.html';
import '/imports/ui/pages/friendRequests.html';
import '/imports/ui/pages/friendRequests.html';

FlowRouter.route('/message/:id?', {
    name: 'home',
    action() {
        if (!Meteor.userId()) {
            FlowRouter.go('/login');
        } else {
            this.render('mainLayout', { main: 'home' });
        }
    }
});

FlowRouter.route('/', {
    name: 'home',
    action() {
        if (!Meteor.userId()) {
            FlowRouter.go('/login');
        } else {
            FlowRouter.go('/message');
        }
    }
});

FlowRouter.route('/friends', {
    name: 'friends',
    action() {
        if (!Meteor.userId()) {
            FlowRouter.go('/login');
        } else {
            this.render('mainLayout', { main: 'friends' });
        }
    }
});

FlowRouter.route('/groups', {
    name: 'groups',
    action() {
        if (!Meteor.userId()) {
            FlowRouter.go('/login');
        } else {
            this.render('mainLayout', { main: 'groups' });
        }
    }
});

FlowRouter.route('/friend-requests', {
    name: 'friendRequests',
    action() {
        if (!Meteor.userId()) {
            FlowRouter.go('/login');
        } else {
            this.render('mainLayout', { main: 'friendRequests' });
        }
    }
});

FlowRouter.route('/group-invitations', {
    name: 'groupInvitations',
    action() {
        if (!Meteor.userId()) {
            FlowRouter.go('/login');
        } else {
            this.render('mainLayout', { main: 'groupInvitations' });
        }
    }
});

FlowRouter.route('/login', {
    name: 'login',
    action() {
        this.render('login');
    }
});

