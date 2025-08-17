import { Template } from 'meteor/templating';
import { FlowRouter } from 'meteor/ostrio:flow-router-extra';
import './subSidebar.html';
import './subSidebar.css';

Template.subSidebar.helpers({
    isActiveRoute(route) {
        const currentPath = FlowRouter.current().path;
        if (route !== '/' && currentPath.startsWith(route)) {
            return 'active-sub-item';
        }
        return '';
    }
});

Template.subSidebar.events({
    "click .btn-redirect"(event) {
        const target = event.currentTarget.dataset.href;
        FlowRouter.go(target);
    }
});
