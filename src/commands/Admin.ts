import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import type { GuildMember as SelfGuildMember } from 'discord.js-selfbot-v13';

import { buildContainerHeader, buildErrorContainer } from '../utils/ContainerUtil';
import type { BridgeCommandContext, PrefixCommand } from './types';

// --- Helpers ---

async function resolveSelfGuild(context: BridgeCommandContext) {
  const guildId = context.interaction.guildId;
  if (!guildId) return null;
  return (
    context.client.guilds.cache.get(guildId) ??
    (await context.client.guilds.fetch(guildId).catch(() => null))
  );
}

async function resolveSelfMember(
  context: BridgeCommandContext,
  userId: string,
): Promise<SelfGuildMember | null> {
  const guild = await resolveSelfGuild(context);
  if (!guild) return null;
  return guild.members.fetch(userId).catch(() => null);
}

function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    return `${h} hour${h !== 1 ? 's' : ''}`;
  }
  const d = Math.floor(minutes / 1440);
  return `${d} day${d !== 1 ? 's' : ''}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// --- Subcommand handlers ---

async function handleAddAllRoles(context: BridgeCommandContext): Promise<void> {
  const guild = await resolveSelfGuild(context);
  if (!guild) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Not in a server', 'This command must be used in a server.')],
    });
    return;
  }

  const targetUser = context.interaction.options.getUser('member', true);
  const member = await resolveSelfMember(context, targetUser.id);
  if (!member) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Member not found', `<@${targetUser.id}> is not in this server.`)],
    });
    return;
  }

  const assignable = guild.roles.cache.filter(r => !r.managed && r.id !== guild.id);
  try {
    await member.roles.add(assignable, 'Admin: addallroles');
    await context.interaction.editReply({
      components: [
        buildContainerHeader('Roles Added', `Added **${assignable.size}** role(s) to <@${targetUser.id}>.`),
      ],
    });
  } catch (error) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Failed to add roles', errorMessage(error))],
    });
  }
}

async function handleRemoveAllRoles(context: BridgeCommandContext): Promise<void> {
  const guild = await resolveSelfGuild(context);
  if (!guild) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Not in a server', 'This command must be used in a server.')],
    });
    return;
  }

  const targetUser = context.interaction.options.getUser('member', true);
  const member = await resolveSelfMember(context, targetUser.id);
  if (!member) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Member not found', `<@${targetUser.id}> is not in this server.`)],
    });
    return;
  }

  const removable = member.roles.cache.filter(r => !r.managed && r.id !== guild.id);
  try {
    await member.roles.remove(removable, 'Admin: removeallroles');
    await context.interaction.editReply({
      components: [
        buildContainerHeader('Roles Removed', `Removed **${removable.size}** role(s) from <@${targetUser.id}>.`),
      ],
    });
  } catch (error) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Failed to remove roles', errorMessage(error))],
    });
  }
}

async function handleBan(context: BridgeCommandContext): Promise<void> {
  const guild = await resolveSelfGuild(context);
  if (!guild) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Not in a server', 'This command must be used in a server.')],
    });
    return;
  }

  const targetUser = context.interaction.options.getUser('member', true);
  const reason = context.interaction.options.getString('reason') ?? undefined;
  const deleteMessageDays = context.interaction.options.getInteger('delete_message_days') ?? 0;

  try {
    await guild.members.ban(targetUser.id, {
      deleteMessageSeconds: deleteMessageDays * 86400,
      reason,
    });
    await context.interaction.editReply({
      components: [
        buildContainerHeader(
          'Member Banned',
          [
            `<@${targetUser.id}> has been banned.`,
            reason ? `**Reason:** ${reason}` : null,
            `**Messages deleted:** Last ${deleteMessageDays} day(s)`,
          ]
            .filter(Boolean)
            .join('\n'),
        ),
      ],
    });
  } catch (error) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Ban failed', errorMessage(error))],
    });
  }
}

async function handleHackBan(context: BridgeCommandContext): Promise<void> {
  const guild = await resolveSelfGuild(context);
  if (!guild) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Not in a server', 'This command must be used in a server.')],
    });
    return;
  }

  const userId = context.interaction.options.getString('user_id', true).trim();
  const reason = context.interaction.options.getString('reason') ?? undefined;

  if (!/^\d{17,20}$/.test(userId)) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Invalid ID', 'Please provide a valid Discord user ID (17–20 digits).')],
    });
    return;
  }

  try {
    await guild.members.ban(userId, { reason });
    await context.interaction.editReply({
      components: [
        buildContainerHeader(
          'User Banned',
          [
            `User \`${userId}\` has been banned.`,
            reason ? `**Reason:** ${reason}` : null,
          ]
            .filter(Boolean)
            .join('\n'),
        ),
      ],
    });
  } catch (error) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Hackban failed', errorMessage(error))],
    });
  }
}

async function handleBans(context: BridgeCommandContext): Promise<void> {
  const guild = await resolveSelfGuild(context);
  if (!guild) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Not in a server', 'This command must be used in a server.')],
    });
    return;
  }

  const limit = context.interaction.options.getInteger('limit') ?? 10;

  try {
    const bans = await guild.bans.fetch({ limit });

    if (bans.size === 0) {
      await context.interaction.editReply({
        components: [buildContainerHeader('Ban List', 'No users are currently banned.')],
      });
      return;
    }

    const lines = [...bans.values()].map((ban, i) => {
      const reason = ban.reason ? ` — ${ban.reason}` : '';
      return `${i + 1}. **${ban.user.tag}** (\`${ban.user.id}\`)${reason}`;
    });

    await context.interaction.editReply({
      components: [
        buildContainerHeader(`Ban List (${bans.size})`, lines.join('\n')),
      ],
    });
  } catch (error) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Failed to fetch bans', errorMessage(error))],
    });
  }
}

async function handleUnban(context: BridgeCommandContext): Promise<void> {
  const guild = await resolveSelfGuild(context);
  if (!guild) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Not in a server', 'This command must be used in a server.')],
    });
    return;
  }

  const userId = context.interaction.options.getString('user_id', true).trim();
  const reason = context.interaction.options.getString('reason') ?? undefined;

  if (!/^\d{17,20}$/.test(userId)) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Invalid ID', 'Please provide a valid Discord user ID (17–20 digits).')],
    });
    return;
  }

  try {
    const unbanned = await guild.members.unban(userId, reason);
    const name = unbanned?.tag ?? userId;
    await context.interaction.editReply({
      components: [
        buildContainerHeader(
          'User Unbanned',
          [
            `**${name}** has been unbanned.`,
            reason ? `**Reason:** ${reason}` : null,
          ]
            .filter(Boolean)
            .join('\n'),
        ),
      ],
    });
  } catch (error) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Unban failed', errorMessage(error))],
    });
  }
}

async function handleKick(context: BridgeCommandContext): Promise<void> {
  const guild = await resolveSelfGuild(context);
  if (!guild) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Not in a server', 'This command must be used in a server.')],
    });
    return;
  }

  const targetUser = context.interaction.options.getUser('member', true);
  const reason = context.interaction.options.getString('reason') ?? undefined;
  const member = await resolveSelfMember(context, targetUser.id);

  if (!member) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Member not found', `<@${targetUser.id}> is not in this server.`)],
    });
    return;
  }

  try {
    await member.kick(reason);
    await context.interaction.editReply({
      components: [
        buildContainerHeader(
          'Member Kicked',
          [
            `<@${targetUser.id}> has been kicked.`,
            reason ? `**Reason:** ${reason}` : null,
          ]
            .filter(Boolean)
            .join('\n'),
        ),
      ],
    });
  } catch (error) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Kick failed', errorMessage(error))],
    });
  }
}

async function handleTimeout(context: BridgeCommandContext): Promise<void> {
  const guild = await resolveSelfGuild(context);
  if (!guild) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Not in a server', 'This command must be used in a server.')],
    });
    return;
  }

  const targetUser = context.interaction.options.getUser('member', true);
  const durationMinutes = context.interaction.options.getInteger('duration_minutes', true);
  const reason = context.interaction.options.getString('reason') ?? undefined;
  const member = await resolveSelfMember(context, targetUser.id);

  if (!member) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Member not found', `<@${targetUser.id}> is not in this server.`)],
    });
    return;
  }

  try {
    await member.timeout(durationMinutes * 60 * 1000, reason);
    await context.interaction.editReply({
      components: [
        buildContainerHeader(
          'Member Timed Out',
          [
            `<@${targetUser.id}> has been timed out for **${formatDurationMinutes(durationMinutes)}**.`,
            reason ? `**Reason:** ${reason}` : null,
          ]
            .filter(Boolean)
            .join('\n'),
        ),
      ],
    });
  } catch (error) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Timeout failed', errorMessage(error))],
    });
  }
}

async function handleRemoveTimeout(context: BridgeCommandContext): Promise<void> {
  const guild = await resolveSelfGuild(context);
  if (!guild) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Not in a server', 'This command must be used in a server.')],
    });
    return;
  }

  const targetUser = context.interaction.options.getUser('member', true);
  const member = await resolveSelfMember(context, targetUser.id);

  if (!member) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Member not found', `<@${targetUser.id}> is not in this server.`)],
    });
    return;
  }

  try {
    await member.timeout(null);
    await context.interaction.editReply({
      components: [
        buildContainerHeader('Timeout Removed', `<@${targetUser.id}>'s timeout has been removed.`),
      ],
    });
  } catch (error) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Failed to remove timeout', errorMessage(error))],
    });
  }
}

async function handleSoftBan(context: BridgeCommandContext): Promise<void> {
  const guild = await resolveSelfGuild(context);
  if (!guild) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Not in a server', 'This command must be used in a server.')],
    });
    return;
  }

  const targetUser = context.interaction.options.getUser('member', true);
  const reason = context.interaction.options.getString('reason') ?? 'Softban';
  const deleteMessageDays = context.interaction.options.getInteger('delete_message_days') ?? 7;

  try {
    await guild.members.ban(targetUser.id, {
      deleteMessageSeconds: deleteMessageDays * 86400,
      reason,
    });
    await guild.members.unban(targetUser.id, 'Softban: removing ban after message deletion');
    await context.interaction.editReply({
      components: [
        buildContainerHeader(
          'Member Softbanned',
          [
            `<@${targetUser.id}> has been softbanned.`,
            `**Messages deleted:** Last ${deleteMessageDays} day(s)`,
            `**Reason:** ${reason}`,
          ].join('\n'),
        ),
      ],
    });
  } catch (error) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Softban failed', errorMessage(error))],
    });
  }
}

async function handlePurge(context: BridgeCommandContext): Promise<void> {
  const channelId = context.interaction.channelId;
  const amount = context.interaction.options.getInteger('amount', true);
  const targetUser = context.interaction.options.getUser('user');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selfChannel = context.client.channels.cache.get(channelId) as any;
  if (!selfChannel?.messages) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Channel error', 'Could not find the current text channel via selfbot.')],
    });
    return;
  }

  try {
    const fetched = await selfChannel.messages.fetch({ limit: Math.min(amount, 100) });
    const toDelete = targetUser
      ? fetched.filter((msg: { author: { id: string } }) => msg.author.id === targetUser.id)
      : fetched;

    let deletedCount = 0;
    for (const message of toDelete.values()) {
      await (message as { delete(): Promise<unknown> }).delete().catch(() => null);
      deletedCount++;
    }

    await context.interaction.editReply({
      components: [
        buildContainerHeader(
          'Messages Purged',
          [
            `Deleted **${deletedCount}** message(s).`,
            targetUser ? `**Filtered by:** <@${targetUser.id}>` : null,
          ]
            .filter(Boolean)
            .join('\n'),
        ),
      ],
    });
  } catch (error) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Purge failed', errorMessage(error))],
    });
  }
}

async function handleNuke(context: BridgeCommandContext): Promise<void> {
  const channelId = context.interaction.channelId;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selfChannel = context.client.channels.cache.get(channelId) as any;

  if (!selfChannel) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Channel error', 'Could not find the current channel via selfbot.')],
    });
    return;
  }

  try {
    const position = selfChannel.position as number;
    const cloned = await selfChannel.clone({ reason: 'Admin: nuke' });
    await (cloned as { setPosition(pos: number): Promise<unknown> }).setPosition(position).catch(() => null);
    await selfChannel.delete('Admin: nuke');

    // Interaction token stays valid for 15 min regardless of channel deletion
    await context.interaction.editReply({
      components: [
        buildContainerHeader(
          'Channel Nuked',
          `<#${(cloned as { id: string }).id}> has been recreated. All previous messages have been cleared.`,
        ),
      ],
    });
  } catch (error) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Nuke failed', errorMessage(error))],
    });
  }
}

async function handleCreateChannel(context: BridgeCommandContext): Promise<void> {
  const guild = await resolveSelfGuild(context);
  if (!guild) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Not in a server', 'This command must be used in a server.')],
    });
    return;
  }

  const name = context.interaction.options.getString('name', true);
  const rawType = context.interaction.options.getString('type') ?? 'text';
  const parentId = context.interaction.options.getString('category') ?? undefined;

  const typeMap: Record<string, string> = {
    text: 'GUILD_TEXT',
    voice: 'GUILD_VOICE',
    category: 'GUILD_CATEGORY',
    announcement: 'GUILD_ANNOUNCEMENT',
  };

  const channelType = typeMap[rawType] ?? 'GUILD_TEXT';

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const created = await (guild.channels as any).create(name, {
      type: channelType,
      parent: parentId,
      reason: 'Admin: createchannel',
    });

    await context.interaction.editReply({
      components: [
        buildContainerHeader(
          'Channel Created',
          [
            `<#${(created as { id: string }).id}> has been created.`,
            `**Type:** ${rawType}`,
            parentId ? `**Category:** <#${parentId}>` : null,
          ]
            .filter(Boolean)
            .join('\n'),
        ),
      ],
    });
  } catch (error) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Channel creation failed', errorMessage(error))],
    });
  }
}

async function handleSlowmode(context: BridgeCommandContext): Promise<void> {
  const channelId = context.interaction.channelId;
  const seconds = context.interaction.options.getInteger('seconds', true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selfChannel = context.client.channels.cache.get(channelId) as any;

  if (!selfChannel?.setRateLimitPerUser) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Channel error', 'Could not find the current channel via selfbot.')],
    });
    return;
  }

  try {
    await selfChannel.setRateLimitPerUser(seconds, 'Admin: slowmode');
    const description = seconds === 0
      ? 'Slowmode has been **disabled**.'
      : `Slowmode set to **${seconds}s** per message.`;

    await context.interaction.editReply({
      components: [buildContainerHeader('Slowmode Updated', description)],
    });
  } catch (error) {
    await context.interaction.editReply({
      components: [buildErrorContainer('Slowmode failed', errorMessage(error))],
    });
  }
}

// --- Command export ---

export const adminCommand: PrefixCommand = {
  name: 'admin',
  category: 'Admin',
  description: 'Server administration utilities.',
  usage: 'admin — use /admin via the bridge bot',
  enabled(config) {
    return config.features.admin;
  },
  async execute(context) {
    await context.respond({
      content: 'Use the bridge slash command **/admin** for administration actions.',
    });
  },
  bridge: {
    data: new SlashCommandBuilder()
      .setName('admin')
      .setDescription('Server administration utilities.')
      .addSubcommand(sub =>
        sub
          .setName('addallroles')
          .setDescription('Add all non-managed roles to a member.')
          .addUserOption(opt => opt.setName('member').setDescription('Target member').setRequired(true)),
      )
      .addSubcommand(sub =>
        sub
          .setName('ban')
          .setDescription('Ban a member from the server.')
          .addUserOption(opt => opt.setName('member').setDescription('Member to ban').setRequired(true))
          .addStringOption(opt => opt.setName('reason').setDescription('Ban reason').setRequired(false))
          .addIntegerOption(opt =>
            opt
              .setName('delete_message_days')
              .setDescription('Days of messages to delete (0–7)')
              .setMinValue(0)
              .setMaxValue(7)
              .setRequired(false),
          ),
      )
      .addSubcommand(sub =>
        sub
          .setName('bans')
          .setDescription('Show banned users from the server.')
          .addIntegerOption(opt =>
            opt
              .setName('limit')
              .setDescription('Number of bans to show (1–50, default 10)')
              .setMinValue(1)
              .setMaxValue(50)
              .setRequired(false),
          ),
      )
      .addSubcommand(sub =>
        sub
          .setName('createchannel')
          .setDescription('Create a new channel.')
          .addStringOption(opt => opt.setName('name').setDescription('Channel name').setRequired(true))
          .addStringOption(opt =>
            opt
              .setName('type')
              .setDescription('Channel type (default: text)')
              .setRequired(false)
              .addChoices(
                { name: 'Text', value: 'text' },
                { name: 'Voice', value: 'voice' },
                { name: 'Category', value: 'category' },
                { name: 'Announcement', value: 'announcement' },
              ),
          )
          .addStringOption(opt =>
            opt.setName('category').setDescription('Parent category ID').setRequired(false),
          ),
      )
      .addSubcommand(sub =>
        sub
          .setName('hackban')
          .setDescription('Ban a user that is not in the server by ID.')
          .addStringOption(opt =>
            opt.setName('user_id').setDescription('Discord user ID (17–20 digits)').setRequired(true),
          )
          .addStringOption(opt => opt.setName('reason').setDescription('Ban reason').setRequired(false)),
      )
      .addSubcommand(sub =>
        sub
          .setName('kick')
          .setDescription('Kick a member from the server.')
          .addUserOption(opt => opt.setName('member').setDescription('Member to kick').setRequired(true))
          .addStringOption(opt => opt.setName('reason').setDescription('Kick reason').setRequired(false)),
      )
      .addSubcommand(sub =>
        sub.setName('nuke').setDescription('Clone and delete the current channel to clear all messages.'),
      )
      .addSubcommand(sub =>
        sub
          .setName('purge')
          .setDescription('Delete recent messages in the current channel.')
          .addIntegerOption(opt =>
            opt
              .setName('amount')
              .setDescription('Number of messages to delete (1–100)')
              .setMinValue(1)
              .setMaxValue(100)
              .setRequired(true),
          )
          .addUserOption(opt =>
            opt.setName('user').setDescription('Only delete messages from this user').setRequired(false),
          ),
      )
      .addSubcommand(sub =>
        sub
          .setName('removeallroles')
          .setDescription('Remove all non-managed roles from a member.')
          .addUserOption(opt => opt.setName('member').setDescription('Target member').setRequired(true)),
      )
      .addSubcommand(sub =>
        sub
          .setName('removetimeout')
          .setDescription('Remove an active timeout from a member.')
          .addUserOption(opt => opt.setName('member').setDescription('Target member').setRequired(true)),
      )
      .addSubcommand(sub =>
        sub
          .setName('slowmode')
          .setDescription('Set slowmode on the current channel (0 to disable).')
          .addIntegerOption(opt =>
            opt
              .setName('seconds')
              .setDescription('Slowmode delay in seconds (0–21600)')
              .setMinValue(0)
              .setMaxValue(21600)
              .setRequired(true),
          ),
      )
      .addSubcommand(sub =>
        sub
          .setName('softban')
          .setDescription('Ban and immediately unban a member to delete their messages.')
          .addUserOption(opt => opt.setName('member').setDescription('Member to softban').setRequired(true))
          .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(false))
          .addIntegerOption(opt =>
            opt
              .setName('delete_message_days')
              .setDescription('Days of messages to delete (1–7, default 7)')
              .setMinValue(1)
              .setMaxValue(7)
              .setRequired(false),
          ),
      )
      .addSubcommand(sub =>
        sub
          .setName('timeout')
          .setDescription('Timeout a member.')
          .addUserOption(opt => opt.setName('member').setDescription('Member to timeout').setRequired(true))
          .addIntegerOption(opt =>
            opt
              .setName('duration_minutes')
              .setDescription('Timeout duration in minutes (1–40320 / max 28 days)')
              .setMinValue(1)
              .setMaxValue(40320)
              .setRequired(true),
          )
          .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(false)),
      )
      .addSubcommand(sub =>
        sub
          .setName('unban')
          .setDescription('Unban a user from the server.')
          .addStringOption(opt =>
            opt.setName('user_id').setDescription('Discord user ID (17–20 digits)').setRequired(true),
          )
          .addStringOption(opt => opt.setName('reason').setDescription('Unban reason').setRequired(false)),
      ),

    execute: async context => {
      await context.interaction.deferReply({
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });

      // Discord re-validates component types on every PATCH and rejects V2 types (Container, etc.)
      // unless IS_COMPONENTS_V2 is included in the editReply body — it does NOT inherit from deferReply.
      // Patching this specific instance propagates the flag to all handler editReply calls automatically.
      const _origEditReply = context.interaction.editReply.bind(context.interaction);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (context.interaction as any).editReply = (options: any) =>
        _origEditReply({ ...options, flags: ((options.flags as number) ?? 0) | MessageFlags.IsComponentsV2 });

      const subcommand = context.interaction.options.getSubcommand(true);

      switch (subcommand) {
        case 'addallroles':
          await handleAddAllRoles(context);
          break;
        case 'removeallroles':
          await handleRemoveAllRoles(context);
          break;
        case 'ban':
          await handleBan(context);
          break;
        case 'hackban':
          await handleHackBan(context);
          break;
        case 'bans':
          await handleBans(context);
          break;
        case 'unban':
          await handleUnban(context);
          break;
        case 'kick':
          await handleKick(context);
          break;
        case 'timeout':
          await handleTimeout(context);
          break;
        case 'removetimeout':
          await handleRemoveTimeout(context);
          break;
        case 'softban':
          await handleSoftBan(context);
          break;
        case 'purge':
          await handlePurge(context);
          break;
        case 'nuke':
          await handleNuke(context);
          break;
        case 'createchannel':
          await handleCreateChannel(context);
          break;
        case 'slowmode':
          await handleSlowmode(context);
          break;
        default:
          await context.interaction.editReply({
            components: [buildErrorContainer('Unknown subcommand', `Subcommand \`${subcommand}\` is not recognized.`)],
          });
      }
    },
  },
};
