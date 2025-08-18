import { Template } from 'meteor/templating';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import './mainLayout.html';
import './mainLayout.css';

Template.mainLayout.helpers({
  isActiveRoute(route) {
    const currentPath = FlowRouter.current().path;
    if (currentPath.startsWith(route)) {
      return 'active';
    }

    const includeFriendItemArr = ['/friends', '/groups', '/friend-requests', '/group-invitations']
    if (route !== '/message' && includeFriendItemArr.includes(currentPath)) {
      return 'active';
    }
    return '';
  }
});

Template.mainLayout.events({
  'click #logout-btn'() {
    Meteor.logout(() => {
      FlowRouter.go('/login');
    });
  }
});