'use strict';

exports.Run = async function Run(caller, _message, _emoji, _user) {
  const self = caller;
  const guild = await self.utils.getGuild(_message.channel.guild.id);
  if (guild.messages.indexOf(_message.id) === -1) return;
  if (!guild) return; // no idea why this would be undefined or null but yea
  const hasRoles = guild.roles.filter(role => role.message === _message.id).length !== 0;
  if (!hasRoles) return;
  const [role] = guild.roles.filter(
    (r) => r.message === _message.id &&
      (r.emoji === _emoji.name || r.emoji.indexOf(_emoji.id) !== -1),
  );
  const emoji =
    _emoji.id === null
      ? _emoji.name
      : `${_emoji.animated ? '<a:' : '<:'}${_emoji.name}:${_emoji.id}>`;
  const message = await self.bot
    .getMessage(_message.channel.id, _message.id)
    .catch(console.error);
  const me = message.channel.guild.members.get(self.bot.user.id);
  const user = message.channel.guild.members.get(_user);
  const lang = self.utils.getLang(guild);
  let claimed = false;
  if (role) {
    if (!me.permission.has('manageRoles')) return;
    let highestRole = 0;
    me.roles.forEach((id) => {
      const { position } = message.channel.guild.roles.get(id);
      if (position > highestRole) highestRole = position;
    });
    if (role.id) {
      const ROLECHECK = message.channel.guild.roles.get(role.id);
      if (!ROLECHECK || ROLECHECK.position >= highestRole) return;
    } else if (role.ids) {
      let higher = false;
      role.ids.forEach((id) => {
        const ROLECHECK = message.channel.guild.roles.get(id);
        if (!ROLECHECK || ROLECHECK.position >= highestRole) higher = true;
      });
      if (higher) return;
    }
    if (role.toggle) {
      const toggleEmojis = guild.roles
        .filter(
          (r) => r.message === _message.id && r.toggle === true && r.id !== role.id,
        )
        .map((r) => r.emoji);
      if (self.userRateLimits[_user] !== undefined) {
        const ms = new Date().getTime() - self.userRateLimits[_user];
        if (ms < 500 * toggleEmojis.length) return;
      }
      self.userRateLimits[_user] = new Date().getTime();
      if (me.permission.has('manageMessages')) {
        const ReactionKeys = Object.keys(message.reactions);
        ReactionKeys.forEach((i, index) => {
          if (
            toggleEmojis.indexOf(i) !== -1 ||
            toggleEmojis.filter((e) => e.indexOf(i) !== -1)[0]
          ) {
            setTimeout(() => {
              message
                .removeReaction(i, _user)
                .catch((e) => caller.logger.warn(`[reactionAdd] ${e.code} ${e.message.replace(/\n\s/g, '')}`));
            }, 100 * index);
          }
        });
      }
    }
    if (role.once) {
      const once = await self.db.get('once');
      const claimedUser = await once.findOne({
        id: _user,
      });
      if (claimedUser) {
        if (claimedUser.claimed.indexOf(role.id) !== -1) {
          claimed = true;
        } else {
          claimedUser.claimed.push(role.id);
          await once.findOneAndUpdate(
            {
              id: _user,
            },
            claimedUser,
          );
        }
      } else {
        await once.insert({
          id: _user,
          claimed: [role.id],
        });
      }
      if (me.permission.has('manageMessages')) {
        await message
          .removeReaction(emoji.replace(/(<:)|(<)|(>)/g, ''), _user)
          .catch((e) => caller.logger.warn(`[reactionAdd] ${e.code} ${e.message.replace(/\n\s/g, '')}`));
      }
    }
    if (role.remove) {
      if (user.roles.indexOf(role.id) !== -1) { user.roles.splice(user.roles.indexOf(role.id), 1); }
      if (user.roles.indexOf(role.add) === -1 && role.add) { user.roles.push(role.add); }
      try {
        await user.edit(
          {
            roles: self.utils.combine(user.roles, role.ids),
          },
          'Reaction Role',
        );
      } catch (e) {
        caller.logger.warn(
          `[reactionAdd] ${e.code} ${e.message.replace(/\n\s/g, '')}`,
        );
        return;
      }
      if (guild.log) {
        self.bot
          .createMessage(guild.log, {
            embed: {
              footer: {
                text: `${user.username}#${user.discriminator}`,
                icon_url: user.avatarURL,
              },
              color: 0x00d62e,
              description: lang.commands.log.giveRemove.replace('$user', user.id).replace('$emoji', role.emoji).replace('$role1', role.id).replace('$role2', role.add),
              timestamp: new Date(),
            },
          })
          .catch((e) => {
            caller.logger.warn(
              `[reactionAdd] ${e.code} ${e.message.replace(/\n\s/g, '')}`,
            );
            if (e.code === 50013 || e.code === 50001) {
              guild.log = '';
              self.utils.updateGuild(guild);
            }
          });
        if (me.permission.has('manageMessages')) {
          await message
            .removeReaction(emoji.replace(/(<:)|(<)|(>)/g, ''), _user)
            .catch(e => caller.logger.warn(
              `[reactionAdd] ${e.code} ${e.message.replace(/\n\s/g, '')}`,
            ));
          }
      }
      return; // eslint-disable-line
    }
    if (role.multi) {
      try {
        await user.edit(
          {
            roles: self.utils.combine(user.roles, role.ids),
          },
          'Reaction Role',
        );
      } catch (e) {
        caller.logger.warn(
          `[reactionAdd] ${e.code} ${e.message.replace(/\n\s/g, '')}`,
        );
        return;
      }
      let roles = '';
      role.ids.forEach((id, index) => {
        roles += `<@&${id}>${index === role.ids.length - 1 ? ' ' : ', '}`;
      });
      if (guild.log) {
        self.bot
          .createMessage(guild.log, {
            embed: {
              footer: {
                text: `${user.username}#${user.discriminator}`,
                icon_url: user.avatarURL,
              },
              color: 0x00d62e,
              description: lang.commands.log.giveMulti.replace('$user', user.id).replace('$emoji', role.emoji).replace('$roles', roles),
              timestamp: new Date(),
            },
          })
          .catch((e) => {
            caller.logger.warn(
              `[reactionAdd] ${e.code} ${e.message.replace(/\n\s/g, '')}`,
            );
            if (e.code === 50013 || e.code === 50001) {
              guild.log = '';
              self.utils.updateGuild(guild);
            }
          });
      }
      return; // eslint-disable-line
    }
    if (!claimed) {
      try {
        if (!me.permission.has('manageRoles')) return;
        await message.channel.guild.addMemberRole(
          _user,
          role.id,
          'Reaction Role',
        );
      } catch (e) {
        caller.logger.warn(
          `[reactionAdd] ${e.code} ${e.message.replace(/\n\s/g, '')}`,
        );
        return;
      }
      if (guild.log) {
        self.bot
          .createMessage(guild.log, {
            embed: {
              footer: {
                text: `${user.username}#${user.discriminator}`,
                icon_url: user.avatarURL,
              },
              color: 0x00d62e,
              description: lang.commands.log.give.replace('$user', user.id).replace('$emoji', role.emoji).replace('$role', role.id),
              timestamp: new Date(),
            },
          })
          .catch((e) => {
            caller.logger.warn(
              `[reactionAdd] ${e.code} ${e.message.replace(/\n\s/g, '')}`,
            );
            if (e.code === 50013 || e.code === 50001) {
              guild.log = '';
              self.utils.updateGuild(guild);
            }
          });
      }
      return; // eslint-disable-line
    }
  }
  if (me.permission.has('manageMessages')) {
    await message
      .removeReaction(emoji.replace(/(<:)|(<)|(>)/g, ''), _user)
      .catch(e => caller.logger.warn(
        `[reactionAdd] ${e.code} ${e.message.replace(/\n\s/g, '')}`,
      ));
    }
};
