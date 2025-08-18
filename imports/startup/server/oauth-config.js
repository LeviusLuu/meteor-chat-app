import { ServiceConfiguration } from 'meteor/service-configuration';

Meteor.startup(async () => {
  await ServiceConfiguration.configurations.upsertAsync(
    { service: 'google' },
    {
      $set: {
        clientId: Meteor.settings.google.clientId,
        secret: Meteor.settings.google.secret
      }
    }
  );
});
