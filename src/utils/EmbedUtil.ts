import { MessageEmbed } from 'discord.js-selfbot-v13';

import type { BotConfig } from '../types/Config';

const DROPLET_FOOTER_TEXT = 'Droplet Services';
const DROPLET_FOOTER_ICON_URL = 'https://cdn.nest.rip/uploads/e97a0336-44d9-49f3-8c45-6bbae88d9f8f.png';

export function buildBaseEmbed(config: BotConfig, title: string, description?: string): MessageEmbed {
  const embed = new MessageEmbed()
    .setTitle(title)
    .setColor(config.embed.color)
    .setAuthor({ name: 'Droplet' });

  if (description) {
    embed.setDescription(description);
  }

  embed.setFooter({ text: DROPLET_FOOTER_TEXT, iconURL: DROPLET_FOOTER_ICON_URL });

  if (config.embed.timestamp) {
    embed.setTimestamp(new Date());
  }

  return embed;
}

export function buildErrorEmbed(config: BotConfig, title: string, message: string): MessageEmbed {
  return buildBaseEmbed(config, title, message).setColor(config.embed.errorColor);
}

export function buildSuccessEmbed(config: BotConfig, title: string, message: string): MessageEmbed {
  return buildBaseEmbed(config, title, message).setColor(config.embed.successColor);
}

export function buildWarningEmbed(config: BotConfig, title: string, message: string): MessageEmbed {
  return buildBaseEmbed(config, title, message).setColor(config.embed.warningColor);
}