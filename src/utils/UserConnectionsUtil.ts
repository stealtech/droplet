import type { Client as SelfClient } from 'discord.js-selfbot-v13';

import { truncate } from './FormatUtil';

export interface UserConnectionsSummary {
  userTag: string;
  mutualFriendsCount: number;
  mutualServerCount: number;
  mutualServerLines: string[];
}

export async function fetchUserConnectionsSummary(client: SelfClient, userId: string): Promise<UserConnectionsSummary> {
  const user = await client.users.fetch(userId);
  const profile = await user.getProfile() as {
    mutual_guilds?: { id: string; nick: string | null }[];
    mutual_friends_count?: number;
  };

  const mutualGuilds = profile.mutual_guilds ?? [];
  const mutualFriendsCount = profile.mutual_friends_count ?? 0;

  const mutualServerLines = mutualGuilds
    .slice(0, 20)
    .map((entry, index) => {
      const guildName = client.guilds.cache.get(entry.id)?.name ?? `Guild ${entry.id}`;
      const nick = entry.nick ? ` — Nick: ${truncate(entry.nick, 40)}` : '';
      return `${index + 1}. **${truncate(guildName, 72)}**${nick}`;
    });

  return {
    userTag: user.tag ?? user.id,
    mutualFriendsCount,
    mutualServerCount: mutualGuilds.length,
    mutualServerLines,
  };
}
