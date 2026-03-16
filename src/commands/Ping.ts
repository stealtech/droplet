import { MessageFlags, SlashCommandBuilder } from 'discord.js';

import { buildContainerHeader } from '../utils/ContainerUtil';
import type { PrefixCommand } from './types';

export const pingCommand: PrefixCommand = {
  name: 'ping',
  category: 'Utility',
  description: 'Show websocket and message latency.',
  usage: 'ping',
  enabled(config) {
    return config.features.ping;
  },
  async execute(context) {
    const wsPing = context.client.ws.ping;
    const messageLatency = Date.now() - context.message.createdTimestamp;

    await context.respond({
      content: [
        '## Latency Report',
        '**Runtime Metrics**',
        `- WebSocket: **${wsPing}ms**`,
        `- Message latency: **${messageLatency}ms**`,
      ].join('\n'),
    });
  },
  bridge: {
    data: new SlashCommandBuilder().setName('ping').setDescription('Show websocket latency.'),
    async execute(context) {
      const container = buildContainerHeader(
        'Latency Report',
        [
          '**Runtime Metrics**',
          `- Bridge WebSocket: **${context.interaction.client.ws.ping}ms**`,
          `- Self account WebSocket: **${context.client.ws.ping}ms**`,
        ].join('\n'),
      );

      await context.interaction.reply({
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        components: [container],
      });
    },
  },
};