import { truncate } from './FormatUtil';

export interface SearchableUser {
	id: string;
	tag: string | null;
	username: string;
	globalName: string | null;
}

export interface TaggableUser {
	tag: string | null;
	username: string;
}

export interface DisplayNameUser {
	globalName: string | null;
	username: string;
}

export interface ProfileBadge {
	id: string;
	description: string;
	icon: string;
	link?: string;
}

export function toSearchFields(user: SearchableUser) {
	return {
		id: user.id,
		tag: user.tag?.toLowerCase() ?? '',
		username: user.username.toLowerCase(),
		globalName: user.globalName?.toLowerCase() ?? '',
	};
}

export function formatUserTag(user: TaggableUser) {
	return user.tag ?? `@${user.username}`;
}

export function getUserDisplayName(user: DisplayNameUser) {
	return user.globalName ?? user.username;
}

export function formatRoleMentions(roleMentions: string[], maxLength = 1024) {
	if (!roleMentions.length) {
		return 'None';
	}

	return truncate(roleMentions.join(' '), maxLength);
}

function normalizeEmojiKey(value: string) {
	return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function sanitizeBioForDisplay(bio: string) {
	return bio
		.replace(/<a?:[a-zA-Z0-9_~]{2,}:[0-9]{17,20}>/g, '')
		.replace(/\s{2,}/g, ' ')
		.trim();
}

function getBadgeEmojiName(badge: ProfileBadge): string | null {
	const id = badge.id.toLowerCase();
	const description = badge.description.toLowerCase();

	if (id.includes('hypesquad_online_house_1') || description.includes('bravery')) return 'hypesquadbravery';
	if (id.includes('hypesquad_online_house_2') || description.includes('brilliance')) return 'hypesquadbrilliance';
	if (id.includes('hypesquad_online_house_3') || description.includes('balance')) return 'hypesquadbalance';
	if (id.includes('hypesquad') || description.includes('hypesquad')) return 'hypesquadevents';
	if (id.includes('partner') || description.includes('partner')) return 'discordpartner';
	if (id.includes('staff') || description.includes('staff')) return 'discordstaff';
	if (id.includes('bug_hunter_level_2') || description.includes('bug hunter level 2')) return 'discordbughunter2';
	if (id.includes('bug_hunter') || description.includes('bug hunter')) return 'discordbughunter1';
	if (id.includes('certified_moderator') || description.includes('moderator')) return 'discordmod';
	if (id.includes('active_developer') || description.includes('active developer')) return 'activedeveloper';
	if (id.includes('early_supporter') || description.includes('early supporter')) return 'discordearlysupporter';
	if (id.includes('verified_bot_developer') || description.includes('supports commands')) return 'supportscommands';
	if (
		id.includes('premium_subscriber') ||
		id.includes('nitro') ||
		description.includes('subscriber since')
	) {
		return 'discordnitro';
	}
	if (
		id.includes('guild_booster') ||
		id.includes('premium_guild_subscriber') ||
		description.includes('server boosting since') ||
		description.includes('boosting since')
	) {
		return 'discordboost1';
	}
	if (id.includes('quest') || description.includes('quest')) return 'quest';
	if (id.includes('orb') || description.includes('orb')) return 'orb';

	return null;
}

function getAppEmojiForBadge(badge: ProfileBadge, appEmojiMap?: Map<string, string>) {
	if (!appEmojiMap?.size) return null;

	const normalizedEntries = [...appEmojiMap.entries()].map(([key, value]) => ({
		normalized: normalizeEmojiKey(key),
		value,
	}));

	const directName = getBadgeEmojiName(badge);
	if (directName) {
		const direct = appEmojiMap.get(directName);
		if (direct) return direct;
	}

	const candidates = [badge.id, badge.description, badge.icon, directName ?? '']
		.map(normalizeEmojiKey)
		.filter(Boolean);

	for (const candidate of candidates) {
		const exact = normalizedEntries.find(entry => entry.normalized === candidate);
		if (exact) return exact.value;

		const partial = normalizedEntries.find(
			entry =>
				(candidate.length >= 5 && entry.normalized.includes(candidate)) ||
				(entry.normalized.length >= 5 && candidate.includes(entry.normalized)),
		);
		if (partial) return partial.value;
	}

	return null;
}

export function formatProfileBadges(badges: ProfileBadge[], appEmojiMap?: Map<string, string>): string {
	if (!badges.length) return '';

	const badgeEmojis = badges
		.map(badge => getAppEmojiForBadge(badge, appEmojiMap))
		.filter((emoji): emoji is string => Boolean(emoji));

	return badgeEmojis.join(' ');
}
