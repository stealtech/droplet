export type HexColor = `#${string}`;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type PresenceActivityType = 'PLAYING' | 'STREAMING' | 'LISTENING' | 'WATCHING' | 'COMPETING';

export type PresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible';
export type SpoofPlatform = 'desktop' | 'web' | 'android' | 'ios' | 'xbox' | 'playstation' | 'vr';

export type SlashPresetArgument = string | number | boolean;

export interface SlashPreset {
  name: string;
  channelId: string;
  botId: string;
  command: string;
  args: SlashPresetArgument[];
}

export interface BotConfig {
  selfbot: {
    token: string;
    commandPrefix: string;
    logLevel: LogLevel;
    deleteCommandMessage: boolean;
  };
  accountSpoof: {
    enabled: boolean;
    platform: SpoofPlatform;
    customBrowser?: string;
  };
  appBot: {
    enabled: boolean;
    token: string;
    clientId: string;
    guildId?: string;
    registerCommandsOnStartup: boolean;
    allowedUserIds: string[];
  };
  presence: {
    enabled: boolean;
    status: PresenceStatus;
    activityType: PresenceActivityType;
    activityText: string;
  };
  features: {
    prefixCommands: boolean;
    help: boolean;
    ping: boolean;
    userInfo: boolean;
    slash: boolean;
    preset: boolean;
    admin: boolean;
  };
  safety: {
    runCommandsFromSelfOnly: boolean;
    ignoreBots: boolean;
    allowInDM: boolean;
    allowedChannelIds: string[];
    blockedChannelIds: string[];
  };
  slash: {
    defaultDeferredTimeoutMs: number;
    parseBooleans: boolean;
    parseNumbers: boolean;
    parseNullAsUndefined: boolean;
    argumentSeparator: string;
    presets: SlashPreset[];
  };
  startup: {
    runPresetsOnReady: string[];
    syncApplicationEmojisOnStartup: boolean;
    applicationEmojiDirectory: string;
    questCompletor: {
      enabled: boolean;
      checkIntervalMs: number;
      autoEnroll: boolean;
      videoProgressStepSeconds: number;
    };
  };
  embed: {
    color: HexColor;
    successColor: HexColor;
    warningColor: HexColor;
    errorColor: HexColor;
    footerText: string;
    timestamp: boolean;
    includeRequesterTag: boolean;
    showAvatarInUserInfo: boolean;
  };
  limits: {
    maxEmbedDescriptionLength: number;
    maxCommandArguments: number;
  };
  formatting: {
    dateLocale: string;
    useRelativeTime: boolean;
  };
}