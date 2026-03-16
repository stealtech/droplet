import {
	MediaGalleryBuilder,
	MediaGalleryItemBuilder,
	MessageFlags,
	SlashCommandBuilder,
	TextDisplayBuilder,
} from 'discord.js';
import type { Client as SelfClient } from 'discord.js-selfbot-v13';

import { buildUserInfoButtons } from '../utils/ComponentUtil';
import { buildContainerHeader, buildErrorContainer } from '../utils/ContainerUtil';
import { extractUserId, formatDiscordTimestamp } from '../utils/FormatUtil';
import {
	formatProfileBadges,
	formatRoleMentions,
	formatUserTag,
	getUserDisplayName,
	sanitizeBioForDisplay,
	toSearchFields,
	type ProfileBadge,
} from '../utils/UserInfoUtil';
import type { PrefixCommand } from './types';

type ResolvedUser = NonNullable<Awaited<ReturnType<typeof resolveUserByInput>>>;

function toSafeCodeBlock(value: string) {
	return value.replaceAll('```', '`\u200b``');
}

async function getPrefixGuildMember(context: Parameters<PrefixCommand['execute']>[0], userId: string) {
	if (!context.message.guild) {
		return undefined;
	}

	try {
		return await context.message.guild.members.fetch(userId);
	} catch {
		return undefined;
	}
}

async function getBridgeGuildMember(context: Parameters<NonNullable<PrefixCommand['bridge']>['execute']>[0], userId: string) {
	if (!context.interaction.inGuild() || !context.interaction.guildId) {
		return undefined;
	}

	const selfGuild =
		context.client.guilds.cache.get(context.interaction.guildId) ??
		(await context.client.guilds.fetch(context.interaction.guildId).catch(() => null));

	if (!selfGuild) {
		return undefined;
	}

	try {
		return await selfGuild.members.fetch(userId);
	} catch {
		return undefined;
	}
}

async function buildPrefixInfoText(context: Parameters<PrefixCommand['execute']>[0], user: ResolvedUser) {
	const member = await getPrefixGuildMember(context, user.id);
	const avatarUrl = user.displayAvatarURL({ size: 1024 });
	const roleMentions = member
		? member.roles.cache
			.filter(role => role.id !== member.guild.id)
			.sort((a, b) => b.position - a.position)
			.map(role => `<@&${role.id}>`)
		: [];

	return [
		`## ${getUserDisplayName(user)}`,
		`<@${user.id}> · ${formatUserTag(user)}`,
		`**Created:** ${formatDiscordTimestamp(user.createdAt, context.config.formatting.useRelativeTime)}`,
		`**Joined:** ${member?.joinedAt ? formatDiscordTimestamp(member.joinedAt, context.config.formatting.useRelativeTime) : 'N/A'}`,
		`**Bot:** ${user.bot ? 'Yes' : 'No'}`,
		`**ID:** \`${user.id}\``,
		`**Roles:** ${formatRoleMentions(roleMentions)}`,
		`[Avatar](${avatarUrl})`,
	].join('\n');
}

function getBridgeRoleMentions(member: Awaited<ReturnType<typeof getBridgeGuildMember>>) {
	if (!member) return [];
	return member.roles.cache
		.filter(role => role.id !== member.guild.id)
		.sort((a, b) => b.position - a.position)
		.map(role => `<@&${role.id}>`);
}

async function getBridgeApplicationEmojiMap(context: Parameters<NonNullable<PrefixCommand['bridge']>['execute']>[0]) {
	const map = new Map<string, string>();

	const application = context.interaction.client.application;
	if (!application) {
		return map;
	}

	try {
		const emojis = await application.emojis.fetch();
		for (const emoji of emojis.values()) {
			if (!emoji.name) continue;
			map.set(emoji.name.toLowerCase(), `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`);
		}
	} catch {
		return map;
	}

	return map;
}

async function buildBridgeInfoEmbed(context: Parameters<NonNullable<PrefixCommand['bridge']>['execute']>[0], user: ResolvedUser) {
	const [member, freshUser, profile, appEmojiMap] = await Promise.all([
		getBridgeGuildMember(context, user.id),
		context.client.users.fetch(user.id, { force: true }),
		user.getProfile().catch(() => null) as Promise<{ badges?: ProfileBadge[]; user_profile?: { bio?: string }; mutual_guilds?: { id: string; nick: string | null }[]; mutual_friends_count?: number } | null>,
		getBridgeApplicationEmojiMap(context),
	]);

	const avatarUrl = user.displayAvatarURL({ size: 1024 });
	const bannerUrl = freshUser.bannerURL({ size: 4096, dynamic: true });
	const avatarDecoUrl = freshUser.avatarDecorationURL();
	const nameplateAsset = freshUser.collectibles?.nameplate?.asset;
	const nameplateUrl = nameplateAsset
		? `https://cdn.discordapp.com/assets/collectibles/${nameplateAsset}`
		: null;

	const roleMentions = getBridgeRoleMentions(member);

	const mutualServersCount = profile?.mutual_guilds?.length ?? 0;
	const mutualFriendsCount = profile?.mutual_friends_count ?? 0;

	const bodyLines = [
		`**Created:** ${formatDiscordTimestamp(user.createdAt, context.config.formatting.useRelativeTime)}`,
		`-# ${mutualServersCount} mutual server${mutualServersCount !== 1 ? 's' : ''} · ${mutualFriendsCount} mutual friend${mutualFriendsCount !== 1 ? 's' : ''}`,
	];

	if (member?.joinedAt) {
		bodyLines.push(
			`**Joined:** ${formatDiscordTimestamp(member.joinedAt, context.config.formatting.useRelativeTime)}`,
		);
	}


	bodyLines.push(
		`**Bot:** ${user.bot ? 'Yes' : 'No'}`,
		`**ID:** \`${user.id}\``,
		`**Roles:** ${formatRoleMentions(roleMentions)}`,
	);

	const badgeEmojis = formatProfileBadges(profile?.badges ?? [], appEmojiMap);
	if (badgeEmojis) {
		bodyLines.push(badgeEmojis);
	}

	const mediaLinks = [
		`[Avatar](${avatarUrl})`,
		bannerUrl ? `[Banner](${bannerUrl})` : null,
		avatarDecoUrl ? `[Avatar Deco](${avatarDecoUrl})` : null,
		nameplateUrl ? `[Nameplate](${nameplateUrl})` : null,
	]
		.filter(Boolean)
		.join(' · ');

	bodyLines.push(mediaLinks);

	const bio = profile?.user_profile?.bio ? sanitizeBioForDisplay(profile.user_profile.bio) : '';
	const headerDesc = bio
		? `${formatUserTag(user)} · <@${user.id}>
\`\`\`
${toSafeCodeBlock(bio)}
\`\`\``
		: `${formatUserTag(user)} · <@${user.id}>`;

	const container = buildContainerHeader(
		getUserDisplayName(user),
		headerDesc,
		avatarUrl,
		`${getUserDisplayName(user)} avatar`,
	).addTextDisplayComponents(new TextDisplayBuilder().setContent(bodyLines.join('\n')));

	if (bannerUrl) {
		container.addMediaGalleryComponents(
			new MediaGalleryBuilder().addItems(
				new MediaGalleryItemBuilder()
					.setURL(bannerUrl)
					.setDescription(`${getUserDisplayName(user)} banner`),
			),
		);
	}

	return container;
}

function buildPrefixAvatarText(_context: Parameters<PrefixCommand['execute']>[0], user: ResolvedUser) {
	const avatarUrl = user.displayAvatarURL({ size: 4096, dynamic: true });
	return `## ${getUserDisplayName(user)} Avatar\n${formatUserTag(user)} · [Open avatar](${avatarUrl})`;
}

function buildBridgeAvatarEmbed(context: Parameters<NonNullable<PrefixCommand['bridge']>['execute']>[0], user: ResolvedUser) {
	const avatarUrl = user.displayAvatarURL({ size: 4096, dynamic: true });

	return buildContainerHeader(
		`${getUserDisplayName(user)} Avatar`,
		`${formatUserTag(user)} · [Open avatar](${avatarUrl})`,
		avatarUrl,
		`${getUserDisplayName(user)} avatar`,
	).addMediaGalleryComponents(
		new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(avatarUrl).setDescription(`${getUserDisplayName(user)} avatar`)),
	);
}

async function buildPrefixBannerText(context: Parameters<PrefixCommand['execute']>[0], user: ResolvedUser) {
	const freshUser = await context.client.users.fetch(user.id, { force: true });
	const bannerUrl = freshUser.bannerURL({ size: 4096, dynamic: true });

	if (!bannerUrl) {
		return `No banner found\n${formatUserTag(user)} does not have a profile banner.`;
	}

	return `## ${getUserDisplayName(user)} Banner\n${formatUserTag(user)} · [Open banner](${bannerUrl})`;
}

async function buildBridgeBannerEmbed(context: Parameters<NonNullable<PrefixCommand['bridge']>['execute']>[0], user: ResolvedUser) {
	const freshUser = await context.client.users.fetch(user.id, { force: true });
	const bannerUrl = freshUser.bannerURL({ size: 4096, dynamic: true });

	if (!bannerUrl) {
		return buildErrorContainer('No banner found', `${formatUserTag(user)} does not have a profile banner.`);
	}

	return buildContainerHeader(
		`${getUserDisplayName(user)} Banner`,
		`${formatUserTag(user)} · [Open banner](${bannerUrl})`,
		user.displayAvatarURL({ size: 1024 }),
		`${getUserDisplayName(user)} avatar`,
	).addMediaGalleryComponents(
		new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(bannerUrl).setDescription(`${getUserDisplayName(user)} banner`)),
	);
}

async function resolveUserByInput(input: string, client: SelfClient) {
	const cleaned = extractUserId(input);

	if (/^\d{17,20}$/.test(cleaned)) {
		return client.users.fetch(cleaned);
	}

	const query = cleaned.toLowerCase();
	return (
		client.users.cache.find(
			candidate => {
				const fields = toSearchFields(candidate);
				return (
					fields.id === query ||
					fields.tag === query ||
					fields.username === query ||
					fields.globalName === query
				);
			},
		) ??
		client.users.cache.find(
			candidate => {
				const fields = toSearchFields(candidate);
				return (
					fields.tag.includes(query) ||
					fields.username.includes(query) ||
					fields.globalName.includes(query)
				);
			},
		)
	);
}

export const userInfoCommand: PrefixCommand = {
	name: 'user',
	aliases: ['userinfo', 'uinfo'],
	category: 'User',
	description: 'Show info, avatar, or banner for yourself or another user.',
	usage: 'user [info|avatar|banner] (@user or user-id)',
	enabled(config) {
		return config.features.userInfo;
	},
	async execute(context) {
		const requestedSubcommand = context.args[0]?.toLowerCase();
		const hasSubcommand = requestedSubcommand === 'info' || requestedSubcommand === 'avatar' || requestedSubcommand === 'banner';
		const subcommand = hasSubcommand ? requestedSubcommand : 'info';
		const candidate = hasSubcommand ? context.args[1] : context.args[0];
		const user = await resolveUserByInput(candidate ?? context.message.author.id, context.client);

		if (!user) {
			await context.respond({
				content: 'User not found. Please provide a valid user mention, ID, or username.',
			});
			return;
		}

		const content =
			subcommand === 'avatar'
				? buildPrefixAvatarText(context, user)
				: subcommand === 'banner'
					? await buildPrefixBannerText(context, user)
					: await buildPrefixInfoText(context, user);

		await context.respond({
			content,
		});
	},
	bridge: {
		data: new SlashCommandBuilder()
			.setName('user')
			.setDescription('User utilities: info, avatar, and banner.')
			.addSubcommand(subcommand =>
				subcommand
					.setName('info')
					.setDescription('Show user profile information.')
					.addStringOption(option =>
						option
							.setName('user')
							.setDescription('User mention, ID, or username')
							.setAutocomplete(true)
							.setRequired(false),
					),
			)
			.addSubcommand(subcommand =>
				subcommand
					.setName('avatar')
					.setDescription('Show a user avatar.')
					.addStringOption(option =>
						option
							.setName('user')
							.setDescription('User mention, ID, or username')
							.setAutocomplete(true)
							.setRequired(false),
					),
			)
			.addSubcommand(subcommand =>
				subcommand
					.setName('banner')
					.setDescription('Show a user banner.')
					.addStringOption(option =>
						option
							.setName('user')
							.setDescription('User mention, ID, or username')
							.setAutocomplete(true)
							.setRequired(false),
					),
			),
		autocomplete: async context => {
			try {
				const focused = context.interaction.options.getFocused(true);
				if (focused.name !== 'user') {
					await context.interaction.respond([]);
					return;
				}

				const query = String(focused.value ?? '').trim();
				const guildId = context.interaction.guildId;

				// Use the selfbot's own guild connection — it's a user account on the gateway
				// and can search all server members, unlike the bridge app bot
				if (guildId && query) {
					const selfGuild = context.client.guilds.cache.get(guildId);
					if (selfGuild) {
						try {
							const members = await selfGuild.members.fetch({ query, limit: 25 });
							const results = [...members.values()].map(member => ({
								name: `${member.user.globalName ?? member.user.username} (${member.user.id})`.slice(0, 100),
								value: member.user.id,
							}));
							if (results.length) {
								await context.interaction.respond(results);
								return;
							}
						} catch {
							// fall through
						}
					}
				}

				// No query or guild search failed — show friends as useful defaults
				const friends = context.client.relationships.friendCache;
				const lq = query.toLowerCase();
				const friendResults = [...friends.values()]
					.filter(u => {
						if (!lq) return true;
						const fields = toSearchFields(u);
						return (
							fields.id.includes(lq) ||
							fields.tag.includes(lq) ||
							fields.username.includes(lq) ||
							fields.globalName.includes(lq)
						);
					})
					.slice(0, 25)
					.map(u => ({
						name: `${formatUserTag(u)} (${u.id})`.slice(0, 100),
						value: u.id,
					}));

				if (friendResults.length) {
					await context.interaction.respond(friendResults);
					return;
				}

				// Last resort: selfbot DM/message cache
				const users = context.client.users.cache
					.filter(user => {
						if (!lq) return true;
						const { id, tag, username, globalName } = toSearchFields(user);
						return (
							id.includes(lq) ||
							tag.includes(lq) ||
							username.includes(lq) ||
							globalName.includes(lq)
						);
					})
					.first(25)
					.map(user => ({
						name: `${formatUserTag(user)} (${user.id})`.slice(0, 100),
						value: user.id,
					}));

				await context.interaction.respond(users);
			} catch {
				// Interaction expired before we could respond — safe to discard
			}
		},
		execute: async context => {
			await context.interaction.deferReply({
				flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
			});

			const subcommand = context.interaction.options.getSubcommand(true);
			const rawTarget = context.interaction.options.getString('user') ?? context.interaction.user.id;
			const user = await resolveUserByInput(rawTarget, context.client);

			if (!user) {
				await context.interaction.editReply({
					components: [
						buildErrorContainer(
							'User not found',
							'Select a valid user from the user picker.',
						),
					],
					flags: MessageFlags.IsComponentsV2,
				});
				return;
			}

			const container =
				subcommand === 'avatar'
					? buildBridgeAvatarEmbed(context, user)
					: subcommand === 'banner'
						? await buildBridgeBannerEmbed(context, user)
						: await buildBridgeInfoEmbed(context, user);

			if (subcommand === 'info') {
				await context.interaction.editReply({
					components: [container, buildUserInfoButtons(user.id)],
					flags: MessageFlags.IsComponentsV2,
				});
				return;
			}

			await context.interaction.editReply({
				components: [container],
				flags: MessageFlags.IsComponentsV2,
			});
		},
	},
};
