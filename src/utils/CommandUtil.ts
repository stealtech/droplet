import type { Message } from 'discord.js-selfbot-v13';

export interface ParsedCommand {
  name: string;
  args: string[];
  rawArgs: string;
}

export function parsePrefixCommand(content: string, prefix: string): ParsedCommand | undefined {
  if (!content.startsWith(prefix)) {
    return undefined;
  }

  const withoutPrefix = content.slice(prefix.length).trim();
  if (!withoutPrefix) {
    return undefined;
  }

  const [nameToken, ...rest] = withoutPrefix.split(/\s+/g);
  if (!nameToken) {
    return undefined;
  }

  const name = nameToken.toLowerCase();
  const rawArgs = withoutPrefix.slice(nameToken.length).trim();
  return {
    name,
    args: rest,
    rawArgs,
  };
}

export function isAllowedCommandContext(message: Message, allowInDM: boolean): boolean {
  if (message.guild) {
    return true;
  }

  return allowInDM;
}
