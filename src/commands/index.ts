import type { BotConfig } from '../types/Config';
import { adminCommand } from './Admin';
import { helpCommand } from './Help';
import { presetCommand } from './Preset';
import { pingCommand } from './Ping';
import { userInfoCommand } from './UserInfo';
import type { PrefixCommand } from './types';

const allCommands: PrefixCommand[] = [helpCommand, pingCommand, userInfoCommand, presetCommand, adminCommand];

export function getEnabledCommands(config: BotConfig): PrefixCommand[] {
  return allCommands.filter(command => command.enabled(config));
}

export function getCommandByName(config: BotConfig, query: string): PrefixCommand | undefined {
  const lookup = query.toLowerCase();

  return getEnabledCommands(config).find(command => {
    if (command.name === lookup) {
      return true;
    }

    return command.aliases?.some(alias => alias.toLowerCase() === lookup) ?? false;
  });
}

export function getBridgeCommands(config: BotConfig): PrefixCommand[] {
  return getEnabledCommands(config).filter(command => Boolean(command.bridge));
}

export function getBridgeCommandByName(config: BotConfig, query: string): PrefixCommand | undefined {
  return getBridgeCommands(config).find(command => command.name === query.toLowerCase());
}
