import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import YAML from 'yaml';
import { z } from 'zod';

import type { BotConfig } from '../types/Config';

const snowflakeSchema = z.string().regex(/^\d{17,20}$/, 'Expected a valid Discord snowflake');

const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected color in #RRGGBB format');

const configSchema = z.object({
  selfbot: z.object({
    token: z.string().min(1, 'bot.token is required'),
    commandPrefix: z.string().min(1, 'selfbot.commandPrefix is required').max(5),
    logLevel: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    deleteCommandMessage: z.boolean().default(false),
  }),
  accountSpoof: z.object({
    enabled: z.boolean().default(false),
    platform: z.enum(['desktop', 'web', 'android', 'ios', 'xbox', 'playstation', 'vr']).default('desktop'),
    customBrowser: z.preprocess(
      value => {
        if (typeof value !== 'string') return value;
        const trimmed = value.trim();
        return trimmed.length === 0 ? undefined : trimmed;
      },
      z.string().optional(),
    ),
  }),
  appBot: z.object({
    enabled: z.boolean().default(false),
    token: z.string().default(''),
    clientId: z.string().default(''),
    guildId: z.preprocess(
      value => {
        if (typeof value !== 'string') return value;
        const trimmed = value.trim();
        return trimmed.length === 0 ? undefined : trimmed;
      },
      snowflakeSchema.optional(),
    ),
    registerCommandsOnStartup: z.boolean().default(true),
    allowedUserIds: z.array(snowflakeSchema).default([]),
  }),
  presence: z.object({
    enabled: z.boolean().default(true),
    status: z.enum(['online', 'idle', 'dnd', 'invisible']).default('online'),
    activityType: z.enum(['PLAYING', 'STREAMING', 'LISTENING', 'WATCHING', 'COMPETING']).default('WATCHING'),
    activityText: z.string().default('Discord'),
  }),
  features: z.object({
    prefixCommands: z.boolean().default(true),
    help: z.boolean().default(true),
    ping: z.boolean().default(true),
    userInfo: z.boolean().default(true),
    slash: z.boolean().default(true),
    preset: z.boolean().default(true),
    admin: z.boolean().default(true),
  }),
  safety: z.object({
    runCommandsFromSelfOnly: z.boolean().default(true),
    ignoreBots: z.boolean().default(true),
    allowInDM: z.boolean().default(true),
    allowedChannelIds: z.array(snowflakeSchema).default([]),
    blockedChannelIds: z.array(snowflakeSchema).default([]),
  }),
  slash: z.object({
    defaultDeferredTimeoutMs: z.number().int().min(1000).max(900000).default(120000),
    parseBooleans: z.boolean().default(true),
    parseNumbers: z.boolean().default(true),
    parseNullAsUndefined: z.boolean().default(true),
    argumentSeparator: z.string().min(1).max(8).default('|'),
    presets: z
      .array(
        z.object({
          name: z.string().min(1),
          channelId: snowflakeSchema,
          botId: snowflakeSchema,
          command: z.string().min(1),
          args: z.array(z.union([z.string(), z.number(), z.boolean()])).default([]),
        }),
      )
      .default([]),
  }),
  startup: z.object({
    runPresetsOnReady: z.array(z.string().min(1)).default([]),
    syncApplicationEmojisOnStartup: z.boolean().default(false),
    applicationEmojiDirectory: z.string().min(1).default('./assets/badge-icons'),
    questCompletor: z.object({
      enabled: z.boolean().default(false),
      checkIntervalMs: z.number().int().min(30000).max(900000).default(120000),
      autoEnroll: z.boolean().default(true),
      videoProgressStepSeconds: z.number().int().min(1).max(60).default(15),
    }).default({
      enabled: false,
      checkIntervalMs: 120000,
      autoEnroll: true,
      videoProgressStepSeconds: 15,
    }),
  }),
  embed: z.object({
    color: hexColorSchema,
    successColor: hexColorSchema,
    warningColor: hexColorSchema,
    errorColor: hexColorSchema,
    footerText: z.string().default('Selfbot Utility'),
    timestamp: z.boolean().default(true),
    includeRequesterTag: z.boolean().default(true),
    showAvatarInUserInfo: z.boolean().default(true),
  }),
  limits: z.object({
    maxEmbedDescriptionLength: z.number().int().min(128).max(4000).default(2048),
    maxCommandArguments: z.number().int().min(1).max(64).default(24),
  }),
  formatting: z.object({
    dateLocale: z.string().default('en-US'),
    useRelativeTime: z.boolean().default(true),
  }),
});

export function loadConfig(configPath = 'config.yaml'): BotConfig {
  const absolutePath = resolve(process.cwd(), configPath);
  const rawYaml = readFileSync(absolutePath, 'utf-8');
  const parsed = YAML.parse(rawYaml);
  const validated = configSchema.parse(parsed);
  return validated as BotConfig;
}