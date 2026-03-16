import { readFile, readdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

import {
  Client as AppClient,
  Events,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
} from 'discord.js';
import { Client as SelfClient, Message } from 'discord.js-selfbot-v13';

import { getBridgeCommandByName, getBridgeCommands, getCommandByName, getEnabledCommands } from './commands';
import { buildBridgeHelpPayload } from './commands/Help';
import {
  HELP_CATEGORY_SELECT_CUSTOM_ID,
  parseUserInfoButtonCustomId,
} from './utils/ComponentUtil';
import { buildContainerHeader, buildErrorContainer } from './utils/ContainerUtil';
import { parsePrefixCommand, isAllowedCommandContext } from './utils/CommandUtil';
import { loadConfig } from './utils/ConfigUtil';
import { createLogger } from './utils/LoggerUtil';
import { getSpoofedBrowser } from './utils/PlatformUtil';
import { startQuestCompletor } from './utils/QuestUtil';
import { fetchReviewDbReviews, formatReviewDbSummaries } from './utils/ReviewDbUtil';
import { findPreset, sendSlashAndResolve } from './utils/SlashUtil';
import { fetchUserConnectionsSummary } from './utils/UserConnectionsUtil';
import { fetchUserPfpMedia } from './utils/UserPfpUtil';

function mapActivityType(type: 'PLAYING' | 'STREAMING' | 'LISTENING' | 'WATCHING' | 'COMPETING') {
  switch (type) {
    case 'PLAYING':
      return 'PLAYING';
    case 'STREAMING':
      return 'STREAMING';
    case 'LISTENING':
      return 'LISTENING';
    case 'WATCHING':
      return 'WATCHING';
    case 'COMPETING':
      return 'COMPETING';
    default:
      return 'WATCHING';
  }
}

const SUPPORTED_EMOJI_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

function toApplicationEmojiName(relativeFilePath: string): string | null {
  const base = relativeFilePath
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[\\/]+/g, '_');
  const normalized = base.replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  if (!normalized) return null;
  const clamped = normalized.slice(0, 32);
  if (clamped.length < 2) return null;
  return clamped;
}

function normalizeEmojiName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

interface EmojiFile {
  fullPath: string;
  relativePath: string;
  extension: string;
}

async function collectEmojiFiles(rootDirectory: string): Promise<{ files: EmojiFile[]; skippedSvgCount: number }> {
  const files: EmojiFile[] = [];
  let skippedSvgCount = 0;

  async function walk(currentAbsolutePath: string, currentRelativePath = ''): Promise<void> {
    const entries = await readdir(currentAbsolutePath, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = join(currentAbsolutePath, entry.name);
      const relativePath = currentRelativePath ? `${currentRelativePath}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await walk(absolutePath, relativePath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = extname(entry.name).toLowerCase();
      if (extension === '.svg') {
        skippedSvgCount += 1;
        continue;
      }

      if (!SUPPORTED_EMOJI_EXTENSIONS.has(extension)) {
        continue;
      }

      files.push({
        fullPath: absolutePath,
        relativePath,
        extension,
      });
    }
  }

  await walk(rootDirectory);
  return { files, skippedSvgCount };
}

function getEmojiMimeType(extension: string): string {
  switch (extension) {
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

export async function startBot(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config.selfbot.logLevel);
  const spoofedBrowser = getSpoofedBrowser(config);
  const client = new SelfClient(
    spoofedBrowser
      ? {
          ws: {
            properties: {
              browser: spoofedBrowser,
              device: spoofedBrowser,
            },
          },
        }
      : undefined,
  );

  client.once('ready', async () => {
    logger.info(`Logged in as ${client.user?.tag ?? 'unknown user'}`);

    startQuestCompletor(client, config, logger);

    if (config.presence.enabled && client.user) {
      client.user.setPresence({
        status: config.presence.status,
        activities: [
          {
            name: config.presence.activityText,
            type: mapActivityType(config.presence.activityType),
          },
        ],
      });
    }

    if (config.startup.runPresetsOnReady.length) {
      for (const presetName of config.startup.runPresetsOnReady) {
        const preset = findPreset(config, presetName);
        if (!preset) {
          logger.warn(`Startup preset "${presetName}" not found in config.slash.presets.`);
          continue;
        }

        try {
          await sendSlashAndResolve(
            client,
            {
              channelId: preset.channelId,
              botId: preset.botId,
              command: preset.command,
              args: preset.args,
            },
            config.slash.defaultDeferredTimeoutMs,
          );
          logger.info(`Startup preset "${preset.name}" executed.`);
        } catch (error) {
          logger.error(`Startup preset "${preset.name}" failed.`, error);
        }
      }
    }
  });

  client.on('messageCreate', async (message: Message) => {
    if (!config.features.prefixCommands) {
      return;
    }

    if (!message.content) {
      return;
    }

    if (config.safety.runCommandsFromSelfOnly && message.author.id !== client.user?.id) {
      return;
    }

    if (config.safety.ignoreBots && message.author.bot) {
      return;
    }

    if (!isAllowedCommandContext(message, config.safety.allowInDM)) {
      return;
    }

    if (config.safety.allowedChannelIds.length && !config.safety.allowedChannelIds.includes(message.channel.id)) {
      return;
    }

    if (config.safety.blockedChannelIds.includes(message.channel.id)) {
      return;
    }

    const parsed = parsePrefixCommand(message.content, config.selfbot.commandPrefix);
    if (!parsed) {
      return;
    }

    const command = getCommandByName(config, parsed.name);

    if (!command) {
      await message.channel.send({
        content: `Unknown command. Use **${config.selfbot.commandPrefix}help**.`,
      });
      return;
    }

    try {
      await command.execute({
        client,
        message,
        args: parsed.args,
        rawArgs: parsed.rawArgs,
        config,
        logger,
        allCommands: getEnabledCommands(config),
        respond(payload) {
          return message.channel.send(payload);
        },
      });

      if (config.selfbot.deleteCommandMessage) {
        await message.delete().catch(() => undefined);
      }
    } catch (error) {
      logger.error(`Command "${parsed.name}" failed.`, error);
      await message.channel.send({
        content: 'Command failed. An unexpected error occurred.',
      });
    }
  });

  await client.login(config.selfbot.token);
  logger.info(`Selfbot is running with prefix ${config.selfbot.commandPrefix}`);
  if (spoofedBrowser) {
    logger.info(`Account platform spoofing enabled via browser property: ${spoofedBrowser}`);
  }

  if (config.appBot.enabled) {
    await startApplicationCommandBridge(client);
  }

  async function startApplicationCommandBridge(selfClient: SelfClient): Promise<void> {
    if (!config.appBot.token || !config.appBot.clientId) {
      logger.error('appBot is enabled but token/clientId is missing in config.yaml.');
      return;
    }

    const appClient = new AppClient({ intents: [GatewayIntentBits.Guilds] });
    const bridgeCommands = getBridgeCommands(config);

    const syncApplicationEmojis = async () => {
      if (!config.startup.syncApplicationEmojisOnStartup) {
        return;
      }

      if (!appClient.application) {
        logger.warn('Emoji sync skipped because appClient.application is not ready.');
        return;
      }

      const emojiDirectory = resolve(process.cwd(), config.startup.applicationEmojiDirectory);

      let emojiFiles: EmojiFile[] = [];
      let skippedSvgCount = 0;
      try {
        const collected = await collectEmojiFiles(emojiDirectory);
        emojiFiles = collected.files;
        skippedSvgCount = collected.skippedSvgCount;
      } catch (error) {
        logger.warn(`Emoji sync skipped: unable to read directory ${emojiDirectory}.`, error);
        return;
      }

      if (!emojiFiles.length) {
        logger.info(`Emoji sync: no image files found in ${emojiDirectory}.`);
        return;
      }

      const existing = await appClient.application.emojis.fetch();
      const existingNames = new Set(existing.map(emoji => emoji.name).filter((name): name is string => Boolean(name)));
      const existingNormalizedNames = new Set([...existingNames].map(name => normalizeEmojiName(name)));

      let createdCount = 0;
      for (const file of emojiFiles) {
        const emojiNameBase = toApplicationEmojiName(file.relativePath);
        const extension = file.extension;

        if (!emojiNameBase) {
          logger.warn(`Emoji sync skipped file "${file.relativePath}" because its name is invalid after normalization.`);
          continue;
        }

        const normalizedBase = normalizeEmojiName(emojiNameBase);
        if (existingNames.has(emojiNameBase) || existingNormalizedNames.has(normalizedBase)) {
          continue;
        }

        try {
          const content = await readFile(file.fullPath);
          const mimeType = getEmojiMimeType(extension);
          const dataUri = `data:${mimeType};base64,${content.toString('base64')}`;
          await appClient.application.emojis.create({ name: emojiNameBase, attachment: dataUri });
          existingNames.add(emojiNameBase);
          existingNormalizedNames.add(normalizedBase);
          createdCount += 1;
        } catch (error) {
          logger.warn(`Emoji sync failed for file "${file.relativePath}".`, error);
        }
      }

      logger.info(`Emoji sync complete: created ${createdCount} application emoji(s); skipped ${skippedSvgCount} svg file(s).`);
    };

    if (config.appBot.registerCommandsOnStartup) {
      const slashCommands = bridgeCommands
        .map(command => command.bridge)
        .filter((bridge): bridge is NonNullable<typeof bridge> => Boolean(bridge))
        .map(bridge => bridge.data.toJSON());

      const rest = new REST({ version: '10' }).setToken(config.appBot.token);

      if (config.appBot.guildId) {
        await rest.put(Routes.applicationGuildCommands(config.appBot.clientId, config.appBot.guildId), {
          body: slashCommands,
        });
      } else {
        await rest.put(Routes.applicationCommands(config.appBot.clientId), {
          body: slashCommands,
        });
      }

      logger.info(`Application commands registered for bridge bot (${slashCommands.length}).`);
    }

    appClient.once(Events.ClientReady, async ready => {
      logger.info(`Bridge app bot logged in as ${ready.user.tag}`);
      await syncApplicationEmojis();
    });

    appClient.on(Events.InteractionCreate, async interaction => {
      if (interaction.isStringSelectMenu() && interaction.customId === HELP_CATEGORY_SELECT_CUSTOM_ID) {
        try {
          if (
            config.appBot.allowedUserIds.length > 0 &&
            !config.appBot.allowedUserIds.includes(interaction.user.id)
          ) {
            await interaction.reply({
              flags: MessageFlags.Ephemeral,
              content: 'You are not allowed to use this menu.',
            });
            return;
          }

          const selectedCategory = interaction.values[0];
          await interaction.deferUpdate();
          await interaction.editReply({
            ...buildBridgeHelpPayload(getEnabledCommands(config), config, selectedCategory),
            flags: MessageFlags.IsComponentsV2,
          });
        } catch {
          // Menu interaction expired or was already acknowledged.
        }
        return;
      }

      if (interaction.isButton()) {
        const payload = parseUserInfoButtonCustomId(interaction.customId);
        if (!payload) {
          return;
        }

        try {
          if (
            config.appBot.allowedUserIds.length > 0 &&
            !config.appBot.allowedUserIds.includes(interaction.user.id)
          ) {
            await interaction.reply({
              flags: MessageFlags.Ephemeral,
              content: 'You are not allowed to use this button.',
            });
            return;
          }

          await interaction.deferReply({
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
          });

          if (payload.action === 'reviews') {
            const reviews = await fetchReviewDbReviews(payload.userId);

            if (!reviews.length) {
              await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [buildErrorContainer('No reviews found', `No ReviewDB entries were found for \`${payload.userId}\`.`)],
              });
              return;
            }

            await interaction.editReply({
              flags: MessageFlags.IsComponentsV2,
              components: [
                buildContainerHeader(
                  `Reviews (${Math.min(reviews.length, 8)}/${reviews.length})`,
                  formatReviewDbSummaries(reviews, 8),
                ),
              ],
            });
            return;
          }

          if (payload.action === 'pfp') {
            const links = await fetchUserPfpMedia(payload.userId);

            if (!links.length) {
              await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [buildErrorContainer('No UserPFP media found', `No UserPFP records were found for \`${payload.userId}\`.`)],
              });
              return;
            }

            const lines = links.slice(0, 12).map((url, index) => `${index + 1}. [Open media ${index + 1}](${url})`);
            await interaction.editReply({
              flags: MessageFlags.IsComponentsV2,
              components: [
                buildContainerHeader(
                  `UserPFP Media (${Math.min(links.length, 12)}/${links.length})`,
                  lines.join('\n'),
                ),
              ],
            });
            return;
          }

          if (payload.action === 'connections') {
            const summary = await fetchUserConnectionsSummary(selfClient, payload.userId);
            const content = [
              `**Mutual friends:** ${summary.mutualFriendsCount}`,
              `**Mutual servers:** ${summary.mutualServerCount}`,
              summary.mutualServerLines.length ? '' : 'No mutual servers available.',
              ...summary.mutualServerLines,
            ].join('\n');

            await interaction.editReply({
              flags: MessageFlags.IsComponentsV2,
              components: [buildContainerHeader(`Connections · ${summary.userTag}`, content)],
            });
            return;
          }

          await interaction.editReply({
            flags: MessageFlags.IsComponentsV2,
            components: [buildErrorContainer('Unknown action', 'This button action is not recognized.')],
          });
        } catch (error) {
          logger.error('User info component action failed.', error);

          try {
            if (interaction.replied || interaction.deferred) {
              await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [buildErrorContainer('Action failed', 'An unexpected error occurred while handling this button.')],
              });
            } else {
              await interaction.reply({
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                components: [buildErrorContainer('Action failed', 'An unexpected error occurred while handling this button.')],
              });
            }
          } catch {
            // ignore follow-up errors for expired interactions
          }
        }

        return;
      }

      if (interaction.isAutocomplete()) {
        const command = getBridgeCommandByName(config, interaction.commandName);
        if (!command?.bridge?.autocomplete) {
          return;
        }

        try {
          await command.bridge.autocomplete({
            client: selfClient,
            interaction,
            config,
          });
        } catch {
          // Autocomplete interactions expire in 3s; silently discard timeout errors
        }
        return;
      }

      if (!interaction.isChatInputCommand()) {
        return;
      }

      if (
        config.appBot.allowedUserIds.length > 0 &&
        !config.appBot.allowedUserIds.includes(interaction.user.id)
      ) {
        await interaction.reply({
          flags: MessageFlags.Ephemeral,
          content: 'You are not allowed to use this command.',
        });
        return;
      }

      try {
        const command = getBridgeCommandByName(config, interaction.commandName);
        if (!command?.bridge) {
          await interaction.reply({
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            components: [buildErrorContainer('Unknown command', 'This command is not available right now.')],
          });
          return;
        }

        await command.bridge.execute({
          client: selfClient,
          interaction,
          config,
          logger,
          allCommands: getEnabledCommands(config),
        });
      } catch (error) {
        logger.error('Bridge application command failed.', error);

        const failurePayload = {
          components: [buildErrorContainer('Command failed', 'An unexpected error occurred while executing this command.')],
        };

        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.editReply(failurePayload);
          } else {
            await interaction.reply({
              ...failurePayload,
              flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
          }
        } catch {
          // Interaction expired or already handled; nothing further to do
        }
      }
    });

    await appClient.login(config.appBot.token);
  }
}
