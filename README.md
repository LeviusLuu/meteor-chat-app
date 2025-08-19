# Realtime Chat with Meteor + Blaze!

## How to Run

Clone this repo. If you don't already have Meteor, see https://docs.meteor.com/about/install.html or just run:

```
npx meteor
```

Then in your project directory, run:

```
meteor npm install
meteor --settings settings.json
```

Open up http://localhost:3000/ and see the result. Try opening in two different windows!

## How to Change Configuration

To change the app configuration, edit the `settings.json` file in the project directory. You can update values such as the app name, theme, or API keys.

Example `settings.json`:

```json
{
  "google": {
    "clientId": "CLIENT_ID",
    "secret": "SECRET_ID"
  },
  "boot": {
    "enabled": true,
    "name": "ChatBot",
    "picture": "/images/chatbot-avatar.jpg",
    "expression": "0 3 * * *",
    "content": "Hello! I'm your friendly neighborhood chatbot."
  }
}
```

After making changes, save the file and restart the app with:

```
meteor --settings
```
