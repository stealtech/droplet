import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';

export const HELP_CATEGORY_SELECT_CUSTOM_ID = 'help:category';

export const USER_INFO_VIEW_REVIEWS_BUTTON_ID = 'user:reviews';
export const USER_INFO_VIEW_PFP_BUTTON_ID = 'user:pfp';
export const USER_INFO_VIEW_CONNECTIONS_BUTTON_ID = 'user:connections';

export type UserInfoButtonAction = 'reviews' | 'pfp' | 'connections';

export interface UserInfoButtonPayload {
  action: UserInfoButtonAction;
  userId: string;
}

export function buildUserInfoButtons(userId: string) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${USER_INFO_VIEW_REVIEWS_BUTTON_ID}:${userId}`)
      .setLabel('View Reviews')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`${USER_INFO_VIEW_PFP_BUTTON_ID}:${userId}`)
      .setLabel('UserPFP')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`${USER_INFO_VIEW_CONNECTIONS_BUTTON_ID}:${userId}`)
      .setLabel('View Connections')
      .setStyle(ButtonStyle.Secondary),
  );
}

export function parseUserInfoButtonCustomId(customId: string): UserInfoButtonPayload | undefined {
  const [prefix, action, userId] = customId.split(':');
  if (prefix !== 'user' || !action || !userId) {
    return undefined;
  }

  if (action !== 'reviews' && action !== 'pfp' && action !== 'connections') {
    return undefined;
  }

  if (!/^\d{17,20}$/.test(userId)) {
    return undefined;
  }

  return { action, userId };
}
