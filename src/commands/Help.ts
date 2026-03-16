import {
  ActionRowBuilder,
  MessageFlags,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextDisplayBuilder,
} from 'discord.js';

import type { BotConfig } from '../types/Config';
import { HELP_CATEGORY_SELECT_CUSTOM_ID } from '../utils/ComponentUtil';
import { buildContainerHeader } from '../utils/ContainerUtil';
import type { PrefixCommand } from './types';

const DROPLET_FOOTER_ICON_URL = 'https://cdn.nest.rip/uploads/add3f63f-01ec-4b89-9998-939a7161a241.png';

function getCategory(command: PrefixCommand): string {
  return command.category?.trim() || 'General';
}

function getCategorizedCommands(commands: PrefixCommand[], config: BotConfig): Map<string, PrefixCommand[]> {
  const map = new Map<string, PrefixCommand[]>();

  for (const command of commands.filter(item => item.enabled(config))) {
    const category = getCategory(command);
    const list = map.get(category) ?? [];
    list.push(command);
    map.set(category, list);
  }

  for (const list of map.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  return new Map([...map.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function getDefaultCategory(categories: string[], preferred?: string): string {
  if (preferred && categories.includes(preferred)) {
    return preferred;
  }
  return categories[0] ?? 'General';
}

function buildHelpCategoryLines(commands: PrefixCommand[], category: string, mode: 'prefix' | 'bridge', prefix: string): string {
  const filtered = commands.filter(command => getCategory(command) === category);

  if (!filtered.length) {
    return 'No commands in this category.';
  }

  return filtered
    .flatMap(command => {
      const aliases = command.aliases?.length ? ` (aliases: ${command.aliases.join(', ')})` : '';
      if (mode === 'prefix') {
        return [`- **${prefix}${command.usage}** — ${command.description}${aliases}`];
      }

      const bridgeJson = command.bridge?.data.toJSON();
      const options = bridgeJson?.options ?? [];
      const subcommands = options.filter(option => option.type === 1);

      if (subcommands.length > 0) {
        return subcommands.map(subcommand => {
          const subName = typeof subcommand.name === 'string' ? subcommand.name : 'unknown';
          const subDescription = typeof subcommand.description === 'string'
            ? subcommand.description
            : command.description;
          return `- **/${command.name} ${subName}** — ${subDescription}`;
        });
      }

      return [`- **/${command.name}** — ${command.description}${aliases}`];
    })
    .join('\n');
}

export function buildBridgeHelpPayload(commands: PrefixCommand[], config: BotConfig, requestedCategory?: string) {
  const categorized = getCategorizedCommands(commands, config);
  const categories = [...categorized.keys()];
  const activeCategory = getDefaultCategory(categories, requestedCategory);

  const container = buildContainerHeader(
    `Command Reference · ${activeCategory}`,
    buildHelpCategoryLines(commands, activeCategory, 'bridge', config.selfbot.commandPrefix),
    DROPLET_FOOTER_ICON_URL,
    'Droplet icon',
  ).addTextDisplayComponents(
    new TextDisplayBuilder().setContent('-# Use the category menu to browse commands. The list updates automatically from enabled commands.'),
  );

  const categoryMenu = new StringSelectMenuBuilder()
    .setCustomId(HELP_CATEGORY_SELECT_CUSTOM_ID)
    .setPlaceholder('Select a command category')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      categories.map(category =>
        new StringSelectMenuOptionBuilder()
          .setLabel(category)
          .setValue(category)
          .setDefault(category === activeCategory),
      ),
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(categoryMenu);

  return {
    components: [container, row],
  };
}

export const helpCommand: PrefixCommand = {
  name: 'help',
  aliases: ['h'],
  category: 'General',
  description: 'Show enabled commands and usage.',
  usage: 'help',
  enabled(config) {
    return config.features.help;
  },
  async execute(context) {
    const categorized = getCategorizedCommands(context.allCommands, context.config);
    const categories = [...categorized.keys()];
    const activeCategory = getDefaultCategory(categories);
    const prefix = context.config.selfbot.commandPrefix;

    await context.respond({
      content: [
        `## Command Reference · ${activeCategory}`,
        buildHelpCategoryLines(context.allCommands, activeCategory, 'prefix', prefix),
        '',
        `Available categories: ${categories.join(', ')}`,
        `Tip: use ${prefix}help to refresh after config changes.`,
      ].join('\n'),
    });
  },
  bridge: {
    data: new SlashCommandBuilder().setName('help').setDescription('Show enabled commands and usage.'),
    async execute(context) {
      await context.interaction.reply({
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        ...buildBridgeHelpPayload(context.allCommands, context.config),
      });
    },
  },
};
