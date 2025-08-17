import { Meteor } from "meteor/meteor";
import { check } from "meteor/check";
import { FriendRequests } from "/imports/api/friendRequests";
import { Inboxes } from "/imports/api/inboxes";
import { Messages } from "/imports/api/messages";
import { Sessions } from "/imports/api/sessions";

Meteor.methods({
  async "users.searchByUsernameOrEmailForSendRequest"(searchTerm) {
    check(searchTerm, String);

    if (!this.userId) {
      throw new Meteor.Error("not-authorized");
    }

    const regex = new RegExp(searchTerm, "i");

    const friends = await FriendRequests.find({
      $or: [
        { requesterId: this.userId },
        { recipientId: this.userId }
      ]
    }).fetchAsync();

    const friendIds = friends.map(friend => {
      return friend.requesterId === this.userId ? friend.recipientId : friend.requesterId;
    });

    return Meteor.users
      .find(
        {
          _id: { $ne: this.userId, $nin: friendIds },
          $or: [
            { "services.google.email": regex },
            { "services.google.name": regex },
            { username: regex },
            { "emails.address": regex },
            { "profile.name": regex },
            { "profile.firstName": regex },
            { "profile.lastName": regex },
          ],
          isSystem: { $exists: false }
        },
        {
          fields: {
            "services.google.email": 1,
            "services.google.name": 1,
            "services.google.picture": 1,
            emails: 1,
            profile: 1,
            username: 1,
          }
        }
      )
      .fetch();
  },
  async "friendRequests.insert"(userId) {
    check(userId, String);

    if (!this.userId) {
      throw new Meteor.Error("not-authorized", "You must be logged in to send a friend request");
    }

    const recipient = await Meteor.users.findOneAsync(userId);
    if (!recipient) {
      throw new Meteor.Error("user-not-found", "User not found");
    }

    try {
      const existingRequest = await FriendRequests.findOneAsync({
        $or: [
          { requesterId: this.userId, recipientId: userId },
          { requesterId: userId, recipientId: this.userId }
        ]
      });

      if (existingRequest) {
        if (existingRequest.status === "accepted") {
          throw new Meteor.Error("already-friends", "You are already friends with this user");
        } else {
          throw new Meteor.Error("request-already-exists", "Friend request already exists");
        }
      }

      return await FriendRequests.insertAsync({
        requesterId: this.userId,
        recipientId: userId,
        status: "pending",
        createdAt: new Date(),
      });
    } catch (error) {
      console.error("Error in friendRequests.insert method:", error);
      throw new Meteor.Error("insert-failed", "Could not send friend request: " + error.message);
    }
  },
  async "friendRequests.getReceived"() {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      const friendRequests = await FriendRequests.find({
        recipientId: this.userId,
        status: 'pending'
      }, {
        sort: { createdAt: -1 }
      }).fetchAsync();

      return Promise.all(friendRequests.map(async (request) => {
        const requester = await Meteor.users.findOneAsync(request.requesterId, {
          fields: {
            username: 1,
            'profile': 1,
            'services.google.name': 1,
            'services.google.picture': 1,
            'services.google.email': 1
          }
        });

        const requesterName = requester ?
          (requester.username ||
            (requester.profile && requester.profile.name) ||
            (requester.services && requester.services.google && requester.services.google.name) ||
            'Unknown user') : 'Unknown user';

        const requesterAvatar = requester ?
          ((requester.profile && requester.profile.avatar) ||
            (requester.services && requester.services.google && requester.services.google.picture) ||
            '/images/default-avatar.png') : '/images/default-avatar.png';

        const requesterEmail = requester ? ((requester.services && requester.services.google && requester.services.google.email) || 'Unknown email') : 'Unknown email';

        return {
          ...request,
          requesterName: requesterName,
          requesterAvatar: requesterAvatar,
          requesterEmail: requesterEmail
        };
      }));
    } catch (error) {
      console.error("Error getting friend requests list:", error);
      throw new Meteor.Error("fetch-failed", "Could not get friend requests list: " + error.message);
    }
  },
  async "friendRequests.getRequested"() {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      const friendRequests = await FriendRequests.find({
        requesterId: this.userId,
        status: 'pending'
      }, {
        sort: { createdAt: -1 }
      }).fetchAsync();

      return Promise.all(friendRequests.map(async (request) => {
        const receiver = await Meteor.users.findOneAsync(request.recipientId, {
          fields: {
            username: 1,
            'profile': 1,
            'services.google.name': 1,
            'services.google.picture': 1,
            'services.google.email': 1
          }
        });

        const receiverName = receiver ?
          (receiver.username ||
            (receiver.profile && receiver.profile.name) ||
            (receiver.services && receiver.services.google && receiver.services.google.name) ||
            'Unknown user') : 'Unknown user';

        const receiverAvatar = receiver ?
          ((receiver.profile && receiver.profile.avatar) ||
            (receiver.services && receiver.services.google && receiver.services.google.picture) ||
            '/images/default-avatar.png') : '/images/default-avatar.png';

        const receiverEmail = receiver ? ((receiver.services && receiver.services.google && receiver.services.google.email) || 'Unknown email') : 'Unknown email';

        return {
          ...request,
          receiverName: receiverName,
          receiverAvatar: receiverAvatar,
          receiverEmail: receiverEmail
        };
      }));
    } catch (error) {
      console.error("Error getting friend request list:", error);
      throw new Meteor.Error("fetch-failed", "Could not get friend request list: " + error.message);
    }
  },
  async "friendRequests.accept"(requestId) {
    check(requestId, String);

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in to accept friend requests');
    }

    const request = await FriendRequests.findOneAsync(requestId);
    if (!request) {
      throw new Meteor.Error('request-not-found', 'Friend request does not exist');
    }

    if (request.recipientId !== this.userId) {
      throw new Meteor.Error('not-recipient', 'You are not the recipient of this request');
    }

    try {
      await FriendRequests.updateAsync(requestId, { $set: { status: 'accepted' } });
      let inbox = await Inboxes.findOneAsync({ members: { $all: [request.recipientId, request.requesterId] } });
      if (!inbox) {
        inbox = await Inboxes.insertAsync({
          members: [request.recipientId, request.requesterId], type: "private", createdAt: new Date(),
          updatedAt: new Date()
        });
      }

      await Messages.insertAsync({
        inboxId: inbox,
        isSystem: true,
        type: "friend_request_accepted",
        createdAt: new Date(),
      });

      return true;
    } catch (error) {
      console.error("Error accepting friend request:", error);
      throw new Meteor.Error("accept-failed", "Could not accept friend request: " + error.message);
    }
  },
  async "friendRequests.delete"(requestId) {
    check(requestId, String);

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in to reject friend requests');
    }

    const request = await FriendRequests.findOneAsync(requestId);
    if (!request) {
      throw new Meteor.Error('request-not-found', 'Friend request does not exist');
    }

    if (request.requesterId !== this.userId) {
      throw new Meteor.Error('not-recipient', 'You are not the recipient of this request');
    }

    try {
      await FriendRequests.removeAsync(requestId);
      return true;
    } catch (error) {
      throw new Meteor.Error("reject-failed", "Could not reject friend request: " + error.message);
    }
  },
  async "friendRequests.unfriend"(requestId) {
    check(requestId, String);

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in to reject friend requests');
    }

    const request = await FriendRequests.findOneAsync(requestId);
    if (!request) {
      throw new Meteor.Error('request-not-found', 'Friend request does not exist');
    }

    try {
      await FriendRequests.removeAsync(requestId);
      return true;
    } catch (error) {
      throw new Meteor.Error("reject-failed", "Could not reject friend request: " + error.message);
    }
  },
  async "friendRequests.getAccepted"() {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      const friendships = await FriendRequests.find({
        $or: [
          { requesterId: this.userId, status: 'accepted' },
          { recipientId: this.userId, status: 'accepted' }
        ]
      }).fetchAsync();

      const friendsData = await Promise.all(friendships.map(async (friendship) => {
        const friendId = friendship.requesterId === this.userId
          ? friendship.recipientId
          : friendship.requesterId;

        const friend = await Meteor.users.findOneAsync(friendId, {
          fields: {
            username: 1,
            'profile': 1,
            'services.google.name': 1,
            'services.google.picture': 1,
            'services.google.email': 1,
            'emails': 1
          }
        });

        if (!friend) return null;

        return {
          _id: friend._id,
          username: friend.username,
          name: friend.profile?.name ||
            friend.services?.google?.name ||
            friend.username ||
            'Unknown user',
          avatar: friend.profile?.avatar ||
            friend.services?.google?.picture ||
            '/images/default-avatar.png',
          email: friend.services?.google?.email ||
            (friend.emails && friend.emails[0]?.address) ||
            'Unknown email',
          friendshipId: friendship._id,
          friendSince: friendship.updatedAt || friendship.createdAt,
          friendship
        };
      }));

      return friendsData.filter(friend => friend !== null);
    } catch (error) {
      console.error("Error getting friend list:", error);
      throw new Meteor.Error('fetch-friends-failed', 'Could not get friend list: ' + error.message);
    }
  },
  async "inboxes.findByUserIds"(userIds) {
    check(userIds, Array);
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      const inboxes = await Inboxes.findOneAsync({ members: { $in: userIds } });
      return inboxes;
    } catch (error) {
      console.error("Error finding inbox:", error);
      throw new Meteor.Error('fetch-inboxes-failed', 'Could not find inbox: ' + error.message);
    }
  },
  async "inboxes.mapLastMessage"(inboxes) {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      inboxes = inboxes.map(async inbox => {
        const userId = inbox.members.find(member => member !== this.userId);
        let user = await Meteor.users.findOneAsync({ _id: userId }, {
          fields: {
            username: 1,
            'profile': 1,
            'services.google.name': 1,
            'services.google.picture': 1,
            'services.google.email': 1,
            'emails': 1
          }
        });

        user = {
          _id: user._id,
          username: user.username,
          name: user.profile?.name ||
            user.services?.google?.name ||
            user.username ||
            'Unknown user',
          avatar: user.profile?.avatar ||
            user.services?.google?.picture ||
            '/images/default-avatar.png',
          email: user.services?.google?.email ||
            (user.emails && user.emails[0]?.address) ||
            'Unknown email'
        };

        const lastMessage = await Messages.findOneAsync({ inboxId: inbox._id }, { sort: { createdAt: -1 } });
        return { ...inbox, user, lastMessage };
      });

      return await Promise.all(inboxes);
    } catch (error) {
      console.error("Error getting inbox list:", error);
      throw new Meteor.Error('fetch-inboxes-failed', 'Could not retrieve inbox list: ' + error.message);
    }
  },
  async "inboxes.getHeaderInfo"(inboxId) {
    let inbox = await Inboxes.findOneAsync(inboxId);
    if (!inbox) {
      return null;
    }

    if (inbox?.type === "group") {
      const members = await Meteor.users.find({ _id: { $in: inbox.members } }).fetchAsync();
      return { ...inbox, members };
    }

    const userId = inbox.members.find(member => member !== this.userId);
    const user = await Meteor.users.findOneAsync({ _id: userId }, {
      fields: {
        username: 1,
        'profile': 1,
        'services.google.name': 1,
        'services.google.picture': 1,
        'services.google.email': 1,
        'emails': 1,
        isSystem: 1
      }
    });

    return {
      _id: user._id,
      username: user.username,
      type: user.type,
      name: user.profile?.name ||
        user.services?.google?.name ||
        user.username ||
        'Unknown user',
      avatar: user.profile?.avatar ||
        user.services?.google?.picture ||
        '/images/default-avatar.png',
      email: user.services?.google?.email ||
        (user.emails && user.emails[0]?.address) ||
        'Unknown email',
      isSystem: user.isSystem || false
    };
  },
  async "inboxes.insertGroup"(members, groupName) {
    check(members, Array);
    check(groupName, String);

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      const newInbox = await Inboxes.insertAsync({
        groupName,
        members,
        type: "group",
        groupLeader: this.userId,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await Messages.insertAsync({
        inboxId: newInbox,
        content: `Group ${groupName} has been created`,
        isSystem: true,
        type: "group_created",
        createdAt: new Date(),
      });

      const inbox = await Inboxes.findOneAsync(newInbox);
      return inbox;
    } catch (error) {
      console.error("Error creating inbox:", error);
      throw new Meteor.Error('create-inbox-failed', 'Could not create inbox: ' + error.message);
    }
  },
  async "messages.mapDataForMessage"(messages) {
    check(messages, Array);

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      messages = messages.map(async message => {
        let content = ""
        if (message.isSystem && message.type === "friend_request_accepted") {
          const inbox = await Inboxes.findOneAsync({ _id: message.inboxId });
          const userId = inbox.members.find(member => member !== this.userId);
          const user = await Meteor.users.findOneAsync({ _id: userId }, {
            fields: {
              username: 1,
              'profile': 1,
              'services.google.name': 1
            }
          });
          content = `You are now friends with ${user?.profile?.name || user.username || 'Unknown user'}`;
        } else {
          content = message.content;
        }
        return { ...message, content };
      })

      return await Promise.all(messages);
    } catch (error) {
      throw new Meteor.Error('fetch-inboxes-failed', 'Could not retrieve message list: ' + error.message);
    }
  },
  async "messages.insert"(inboxId, content) {
    check(inboxId, String);
    check(content, String);

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      const inbox = await Inboxes.findOneAsync(inboxId);
      if (!inbox) {
        throw new Meteor.Error("inbox-not-found", "Conversation not found");
      }

      const messageId = await Messages.insertAsync({
        inboxId,
        content,
        senderId: this.userId,
        createdAt: new Date(),
      });

      await Inboxes.updateAsync(inboxId, {
        $set: {
          lastMessage: {
            _id: messageId,
            content,
            senderId: this.userId,
            createdAt: new Date()
          },
          updatedAt: new Date()
        }
      });

      return {
        _id: messageId,
        inboxId,
        content,
        senderId: this.userId,
        createdAt: new Date()
      };
    } catch (error) {
      console.error("Error sending message:", error);
      throw new Meteor.Error("insert-failed", "Could not send message: " + error.message);
    }
  },
  async "sessions.findUsers"(userIds) {
    check(userIds, Array);
    const sessions = await Sessions.find({ userId: { $in: userIds } }).fetchAsync();
    return sessions;
  },
  async "friendRequests.findFriends"(searchTerm) {
    check(searchTerm, String);

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      let friends = await FriendRequests.find({ $or: [{ requesterId: this.userId }, { recipientId: this.userId }] }).fetchAsync();
      friends = friends.map(x => x.requesterId === this.userId ? x.recipientId : x.requesterId);
      const regex = new RegExp(searchTerm, "i");

      const users = await Meteor.users.find({
        $or: [
          { "services.google.email": regex },
          { "services.google.name": regex },
          { username: regex },
          { "emails.address": regex },
          { "profile.name": regex },
          { "profile.firstName": regex },
          { "profile.lastName": regex },
        ],
        _id: { $in: friends }
      }, {
        fields: {
          username: 1,
          'profile': 1,
          'services.google.name': 1,
          'services.google.picture': 1,
          'services.google.email': 1
        },
      }).fetchAsync();

      return users;
    } catch (error) {
      console.error("Error searching for users:", error);
      throw new Meteor.Error("search-failed", "Could not search for users: " + error.message);
    }
  },
  async "groups.getList"() {
    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      const groups = await Inboxes.find({ type: "group", members: this.userId }).fetchAsync();
      return groups;
    } catch (error) {
      console.error("Error getting group list:", error);
      throw new Meteor.Error("fetch-groups-failed", "Could not get group list: " + error.message);
    }
  },
  async "groups.leaveGroup"(groupId) {
    check(groupId, String);

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      const group = await Inboxes.findOneAsync({ _id: groupId, type: "group" });
      if (!group) {
        throw new Meteor.Error("group-not-found", "Group not found");
      }

      if (group.groupLeader !== this.userId) {
        if (!group.members.includes(this.userId)) {
          throw new Meteor.Error("not-a-member", "You are not a member of this group");
        }
        await Inboxes.updateAsync(groupId, { $pull: { members: this.userId } });
        return { result: true, message: "You have left the group." };
      } else {
        return { message: "You can't leave the group, because you are the leader!", result: false }
      }
    } catch (error) {
      console.error("Error leaving group:", error);
      throw new Meteor.Error("leave-group-failed", "Could not leave group: " + error.message);
    }
  },
  async "groups.updateGroupName"(groupId, newGroupName) {
    check(groupId, String);
    check(newGroupName, String);

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      const group = await Inboxes.findOneAsync({ _id: groupId, type: "group" });
      if (!group) {
        throw new Meteor.Error("group-not-found", "Group not found");
      }

      if (group.groupLeader !== this.userId) {
        throw new Meteor.Error("not-group-leader", "You are not the leader of this group");
      }

      await Inboxes.updateAsync(groupId, { $set: { groupName: newGroupName } });

      await Messages.insertAsync({
        inboxId: groupId,
        content: `Group name has been changed to ${newGroupName}`,
        isSystem: true,
        type: "group_name_changed",
        createdAt: new Date(),
      });

      return { result: true, message: "Group name updated successfully." };
    } catch (error) {
      console.error("Error editing group name:", error);
      throw new Meteor.Error("edit-group-name-failed", "Could not edit group name: " + error.message);
    }
  },
  async "groups.disbandGroup"(groupId) {
    check(groupId, String);

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      const group = await Inboxes.findOneAsync({ _id: groupId, type: "group" });
      if (!group) {
        return { result: false, message: "Group not found." };
      }

      if (group.groupLeader !== this.userId) {
        return { result: false, message: "User is not the group leader." };
      }

      await Inboxes.removeAsync({ _id: groupId });
      await Messages.removeAsync({ inboxId: groupId });

      return { result: true, message: "Group disbanded successfully." };
    } catch (error) {
      console.error("Error disbanding group:", error);
      throw new Meteor.Error("disband-group-failed", "Could not disband group: " + error.message);
    }
  },
  async "groups.changeLeader"(groupId, userId) {
    check(groupId, String);
    check(userId, String);

    if (!this.userId) {
      throw new Meteor.Error('not-authorized', 'You must be logged in');
    }

    try {
      const group = await Inboxes.findOneAsync({ _id: groupId, type: "group" });
      if (!group) {
        throw new Meteor.Error("group-not-found", "Group not found");
      }

      if (group.groupLeader !== this.userId) {
        throw new Meteor.Error("not-group-leader", "You are not the leader of this group");
      }

      await Inboxes.updateAsync(groupId, { $set: { groupLeader: userId } });

      await Messages.insertAsync({
        inboxId: groupId,
        content: `Group leader has been changed to ${userId}`,
        isSystem: true,
        type: "group_leader_changed",
        createdAt: new Date(),
      });

      return { result: true, message: "Group leader updated successfully." };
    } catch (error) {
      console.error("Error changing group leader:", error);
      throw new Meteor.Error("change-group-leader-failed", "Could not change group leader: " + error.message);
    }
  }
});