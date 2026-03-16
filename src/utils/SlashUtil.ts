import type { Client, Message } from 'discord.js-selfbot-v13';

import type { BotConfig, SlashPreset } from '../types/Config';
import { parseLiteral, splitAndClean } from './FormatUtil';

export interface SlashExecutionRequest {
  channelId: string;
  botId: string;
  command: string;
  args: Array<string | number | boolean | undefined>;
}

export interface SlashExecutionResult {
  resultMessage: Message;
  deferred: boolean;
}

function isDeferred(message: Message): boolean {
  return message.flags?.has?.('LOADING') ?? false;
}

export function findPreset(config: BotConfig, name: string): SlashPreset | undefined {
  return config.slash.presets.find(preset => preset.name.toLowerCase() === name.toLowerCase());
}

export function parseSlashArgs(raw: string, config: BotConfig): Array<string | number | boolean | undefined> {
  if (!raw.trim()) {
    return [];
  }

  return splitAndClean(raw, config.slash.argumentSeparator).map(value =>
    parseLiteral(value, {
      parseBooleans: config.slash.parseBooleans,
      parseNumbers: config.slash.parseNumbers,
      parseNullAsUndefined: config.slash.parseNullAsUndefined,
    }),
  );
}

export function parseSlashRequest(rawArgs: string, config: BotConfig): SlashExecutionRequest | undefined {
  const separator = ' -- ';
  const parts = rawArgs.includes(separator) ? rawArgs.split(separator, 2) : [rawArgs, ''];
  const head = parts[0] ?? '';
  const tail = parts[1] ?? '';
  const headTokens = head.trim().split(/\s+/g).filter(Boolean);

  if (headTokens.length < 2) {
    return undefined;
  }

  const [botId, ...commandTokens] = headTokens;
  const command = commandTokens.join(' ').trim();
  if (!botId || !command) {
    return undefined;
  }

  return {
    channelId: '',
    botId,
    command,
    args: parseSlashArgs(tail ?? '', config),
  };
}

export async function sendSlashAndResolve(
  client: Client,
  request: SlashExecutionRequest,
  timeoutMs: number,
): Promise<SlashExecutionResult> {
  const channel = await client.channels.fetch(request.channelId);
  if (!channel || !channel.isText()) {
    throw new Error('Target channel is not a text channel.');
  }

  const initial = await channel.sendSlash(request.botId, request.command, ...request.args);

  if (!initial.isMessage) {
    throw new Error('Slash command returned a modal. This template only handles message responses.');
  }

  if (!isDeferred(initial)) {
    return {
      resultMessage: initial,
      deferred: false,
    };
  }

  const resolved = await waitForMessageUpdate(client, initial.id, timeoutMs);
  return {
    resultMessage: resolved,
    deferred: true,
  };
}

function waitForMessageUpdate(client: Client, messageId: string, timeoutMs: number): Promise<Message> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for deferred slash response.'));
    }, timeoutMs);

    const onUpdate = (oldMessage: unknown, newMessage: unknown) => {
      if (!oldMessage || typeof oldMessage !== 'object' || !('id' in oldMessage)) {
        return;
      }

      if (oldMessage.id !== messageId) {
        return;
      }

      if (!newMessage || typeof newMessage !== 'object' || !('isMessage' in newMessage)) {
        return;
      }

      const casted = newMessage as Message;
      if (!casted.isMessage) {
        return;
      }

      cleanup();
      resolve(casted);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      client.off('messageUpdate', onUpdate);
    };

    client.on('messageUpdate', onUpdate);
  });
}
