import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import type { Client, Message, MessageOptions, MessagePayload } from 'discord.js-selfbot-v13';

import type { BotConfig } from '../types/Config';
import type { createLogger } from '../utils/LoggerUtil';

export interface CommandContext {
  client: Client;
  message: Message;
  args: string[];
  rawArgs: string;
  config: BotConfig;
  logger: ReturnType<typeof createLogger>;
  allCommands: PrefixCommand[];
  respond(content: string | MessagePayload | MessageOptions): Promise<unknown>;
}

export interface PrefixCommand {
  name: string;
  aliases?: string[];
  category?: string;
  description: string;
  usage: string;
  enabled(config: BotConfig): boolean;
  execute(context: CommandContext): Promise<void>;
  bridge?: BridgeCommand;
}

export interface BridgeCommandContext {
  client: Client;
  interaction: ChatInputCommandInteraction;
  config: BotConfig;
  logger: ReturnType<typeof createLogger>;
  allCommands: PrefixCommand[];
}

export interface BridgeAutocompleteContext {
  client: Client;
  interaction: AutocompleteInteraction;
  config: BotConfig;
}

export interface BridgeCommand {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute(context: BridgeCommandContext): Promise<void>;
  autocomplete?(context: BridgeAutocompleteContext): Promise<void>;
}