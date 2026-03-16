import { EmbedBuilder } from 'discord.js';

import type { BotConfig } from '../types/Config';

const DROPLET_FOOTER_TEXT = 'Droplet Services';
const DROPLET_FOOTER_ICON_URL = 'https://cdn.nest.rip/uploads/e97a0336-44d9-49f3-8c45-6bbae88d9f8f.png';

export function buildAppBaseEmbed(config: BotConfig, title: string, description?: string): EmbedBuilder {
  const embed = new EmbedBuilder().setColor(config.embed.color).setTitle(title);

  if (description) {
    embed.setDescription(description);
  }

  embed.setFooter({ text: DROPLET_FOOTER_TEXT, iconURL: DROPLET_FOOTER_ICON_URL });

  if (config.embed.timestamp) {
    embed.setTimestamp();
  }

  return embed;
}

export function buildAppSuccessEmbed(config: BotConfig, title: string, description: string): EmbedBuilder {
  return buildAppBaseEmbed(config, title, description).setColor(config.embed.successColor);
}

export function buildAppErrorEmbed(config: BotConfig, title: string, description: string): EmbedBuilder {
  return buildAppBaseEmbed(config, title, description).setColor(config.embed.errorColor);
}
