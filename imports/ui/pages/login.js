import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import { Template } from 'meteor/templating';
import './login.html';
import './login.css';

Template.login.events({
  'click #login-google-btn'() {
    Meteor.loginWithGoogle({
      requestPermissions: ['email', 'profile']
    }, (err) => {
      if (err) {
        console.error('Login failed:', err);
      } else {
        FlowRouter.go('/message');
      }
    });
  },
});
