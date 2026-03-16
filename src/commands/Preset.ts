import { MessageFlags, SlashCommandBuilder } from 'discord.js';

import { buildContainerHeader, buildErrorContainer } from '../utils/ContainerUtil';
import { findPreset, sendSlashAndResolve } from '../utils/SlashUtil';
import type { PrefixCommand } from './types';

export const presetCommand: PrefixCommand = {
  name: 'preset',
  aliases: ['runpreset'],
  category: 'Automation',
  description: 'Execute a slash preset from config.yaml.',
  usage: 'preset (name)',
  enabled(config) {
    return config.features.preset;
  },
  async execute(context) {
    const presetName = context.args[0];

    if (!presetName) {
      await context.respond({
        content: [
          '## Preset name missing',
          `Usage: **${context.config.selfbot.commandPrefix}preset <name>**`,
        ].join('\n'),
      });
      return;
    }

    const preset = findPreset(context.config, presetName);

    if (!preset) {
      const available = context.config.slash.presets.map(item => item.name).join(', ') || 'none';
      await context.respond({
        content: [
          '## Unknown preset',
          `Preset **${presetName}** was not found.`,
          `Configured presets: ${available}`,
        ].join('\n'),
      });
      return;
    }

    const result = await sendSlashAndResolve(
      context.client,
      {
        channelId: preset.channelId,
        botId: preset.botId,
        command: preset.command,
        args: preset.args,
      },
      context.config.slash.defaultDeferredTimeoutMs,
    );

    await context.respond({
      content: [
        '## Preset Execution Complete',
        '**Execution Summary**',
        `- Preset: **${preset.name}**`,
        `- Channel: <#${preset.channelId}>`,
        `- Deferred response: **${result.deferred ? 'Yes' : 'No'}**`,
      ].join('\n'),
    });
  },
  bridge: {
    data: new SlashCommandBuilder()
      .setName('preset')
      .setDescription('Run a configured slash preset through your selfbot account.')
      .addStringOption(option => option.setName('name').setDescription('Preset name').setRequired(true)),
    async execute(context) {
      const presetName = context.interaction.options.getString('name', true);
      const preset = findPreset(context.config, presetName);

      if (!preset) {
        await context.interaction.reply({
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
          components: [buildErrorContainer('Unknown preset', `Preset **${presetName}** was not found in config.yaml.`)],
        });
        return;
      }

      await context.interaction.deferReply({
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });

      const result = await sendSlashAndResolve(
        context.client,
        {
          channelId: preset.channelId,
          botId: preset.botId,
          command: preset.command,
          args: preset.args,
        },
        context.config.slash.defaultDeferredTimeoutMs,
      );

      await context.interaction.editReply({
        components: [
          buildContainerHeader(
            'Preset Execution Complete',
            [
              `**Execution Summary**`,
              `- Preset: **${preset.name}**`,
              `- Channel: <#${preset.channelId}>`,
              `- Command path: **${preset.command}**`,
              `- Deferred response: **${result.deferred ? 'Yes' : 'No'}**`,
            ].join('\n'),
          ),
        ],
        flags: MessageFlags.IsComponentsV2,
      });
    },
  },
};
