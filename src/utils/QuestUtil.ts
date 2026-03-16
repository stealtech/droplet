import type { Client as SelfClient } from 'discord.js-selfbot-v13';

import type { BotConfig } from '../types/Config';
import type { createLogger } from './LoggerUtil';

type Logger = ReturnType<typeof createLogger>;

type QuestTaskName =
  | 'WATCH_VIDEO'
  | 'WATCH_VIDEO_ON_MOBILE'
  | 'PLAY_ON_DESKTOP'
  | 'STREAM_ON_DESKTOP'
  | 'PLAY_ACTIVITY';

interface QuestTaskConfigEntry {
  target: number;
}

interface QuestApiQuest {
  id: string;
  config: {
    expires_at: string;
    application: { id: string; name: string };
    messages?: { quest_name?: string };
    task_config: { tasks: Partial<Record<QuestTaskName, QuestTaskConfigEntry>> };
  };
  user_status?: {
    enrolled_at?: string;
    completed_at?: string;
    progress?: Partial<Record<QuestTaskName, { value?: number }>>;
  };
}

interface QuestsApiResponse {
  quests?: QuestApiQuest[];
}

class QuestEndpointUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuestEndpointUnavailableError';
  }
}

const PRIORITY_TASKS: QuestTaskName[] = [
  'WATCH_VIDEO',
  'WATCH_VIDEO_ON_MOBILE',
  'PLAY_ON_DESKTOP',
  'STREAM_ON_DESKTOP',
  'PLAY_ACTIVITY',
];

function getQuestName(quest: QuestApiQuest): string {
  return quest.config.messages?.quest_name ?? quest.config.application.name ?? `Quest ${quest.id}`;
}

function isCompleted(quest: QuestApiQuest): boolean {
  return Boolean(quest.user_status?.completed_at);
}

function isExpired(quest: QuestApiQuest): boolean {
  return Date.now() > new Date(quest.config.expires_at).getTime();
}

function getProgress(quest: QuestApiQuest, taskName: QuestTaskName): number {
  return quest.user_status?.progress?.[taskName]?.value ?? 0;
}

function getTaskName(quest: QuestApiQuest): QuestTaskName | undefined {
  for (const taskName of PRIORITY_TASKS) {
    if (quest.config.task_config.tasks[taskName]) {
      return taskName;
    }
  }
  return undefined;
}

async function questApiRequest<T>(
  client: SelfClient,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<T> {
  const segments = path.split('/').filter(Boolean);
  const route = (client as unknown as { api: unknown }).api as Record<string, unknown>;

  const invoke = async (versioned: boolean) => {
    let cursor: unknown = route;
    for (const segment of segments) {
      cursor = (cursor as Record<string, unknown>)[segment];
    }

    const caller = (cursor as Record<string, unknown>)[method.toLowerCase()] as
      | ((options: Record<string, unknown>) => Promise<unknown>)
      | undefined;

    if (!caller) {
      throw new Error(`Quest API route is not callable for ${method} ${path}`);
    }

    const options: Record<string, unknown> = { versioned };
    if (body !== undefined) {
      options.data = body;
    }

    return caller(options) as Promise<T>;
  };

  try {
    return await invoke(true);
  } catch (error) {
    const status = (error as { status?: number } | undefined)?.status;
    if (status !== 404) {
      throw error;
    }
  }

  try {
    return await invoke(false);
  } catch (error) {
    const status = (error as { status?: number } | undefined)?.status;
    if (status === 404) {
      throw new QuestEndpointUnavailableError(`Quest API endpoint not available for ${method} ${path}.`);
    }
    throw error;
  }
}

async function fetchMyQuests(client: SelfClient): Promise<QuestApiQuest[]> {
  const payload = await questApiRequest<QuestsApiResponse | QuestApiQuest[]>(client, 'GET', '/quests/@me');
  if (Array.isArray(payload)) {
    return payload;
  }
  return payload.quests ?? [];
}

async function enrollQuest(client: SelfClient, questId: string): Promise<void> {
  await questApiRequest(client, 'POST', `/quests/${questId}/enroll`, {
    location: 11,
    is_targeted: false,
    metadata_raw: undefined,
  });
}

async function pushVideoProgress(client: SelfClient, questId: string, timestamp: number): Promise<void> {
  await questApiRequest(client, 'POST', `/quests/${questId}/video-progress`, {
    timestamp,
  });
}

async function pushDesktopHeartbeat(client: SelfClient, questId: string, applicationId: string, terminal = false): Promise<void> {
  await questApiRequest(client, 'POST', `/quests/${questId}/heartbeat`, {
    application_id: applicationId,
    terminal,
  });
}

async function processQuest(
  client: SelfClient,
  quest: QuestApiQuest,
  logger: Logger,
  config: BotConfig,
): Promise<'updated' | 'skipped'> {
  const taskName = getTaskName(quest);
  if (!taskName) {
    return 'skipped';
  }

  const questName = getQuestName(quest);
  const taskTarget = quest.config.task_config.tasks[taskName]?.target ?? 0;
  const currentProgress = getProgress(quest, taskName);

  if (taskName === 'WATCH_VIDEO' || taskName === 'WATCH_VIDEO_ON_MOBILE') {
    const step = Math.max(1, config.startup.questCompletor.videoProgressStepSeconds);
    const nextTimestamp = Math.min(taskTarget, currentProgress + step);
    if (nextTimestamp <= currentProgress) {
      return 'skipped';
    }

    await pushVideoProgress(client, quest.id, nextTimestamp);
    logger.info(`Quest progress updated for "${questName}" (${nextTimestamp}/${taskTarget}s).`);
    return 'updated';
  }

  if (taskName === 'PLAY_ON_DESKTOP') {
    const isTerminal = currentProgress + 60 >= taskTarget;
    await pushDesktopHeartbeat(client, quest.id, quest.config.application.id, isTerminal);
    logger.info(`Quest heartbeat sent for "${questName}"${isTerminal ? ' (terminal)' : ''}.`);
    return 'updated';
  }

  logger.debug(`Quest "${questName}" uses unsupported task "${taskName}".`);
  return 'skipped';
}

async function runQuestCompletorPass(client: SelfClient, config: BotConfig, logger: Logger): Promise<void> {
  const allQuests = await fetchMyQuests(client);
  const activeQuests = allQuests.filter(quest => !isCompleted(quest) && !isExpired(quest));

  if (!activeQuests.length) {
    logger.info('Quest completor: no active quests found.');
    return;
  }

  let updatedCount = 0;

  for (const quest of activeQuests) {
    try {
      if (!quest.user_status?.enrolled_at) {
        if (!config.startup.questCompletor.autoEnroll) {
          continue;
        }
        await enrollQuest(client, quest.id);
      }

      const result = await processQuest(client, quest, logger, config);
      if (result === 'updated') {
        updatedCount += 1;
      }
    } catch (error) {
      logger.warn(`Quest completor failed for quest "${getQuestName(quest)}".`, error);
    }
  }

  logger.info(`Quest completor pass complete: ${updatedCount}/${activeQuests.length} active quest(s) updated.`);

  if (client.ws.status === 0) {
    logger.debug('Quest completor: self client websocket still connected.');
  }
}

export function startQuestCompletor(client: SelfClient, config: BotConfig, logger: Logger): void {
  if (!config.startup.questCompletor.enabled) {
    return;
  }

  const intervalMs = Math.max(30_000, config.startup.questCompletor.checkIntervalMs);
  let running = false;
  let disabledDueToEndpoint = false;

  const run = async () => {
    if (disabledDueToEndpoint) {
      return;
    }

    if (running) {
      logger.debug('Quest completor: previous pass still running, skipping this tick.');
      return;
    }

    running = true;
    try {
      await runQuestCompletorPass(client, config, logger);
    } catch (error) {
      if (error instanceof QuestEndpointUnavailableError) {
        disabledDueToEndpoint = true;
        logger.warn('Quest completor disabled: Discord quest endpoint is unavailable for this account/session.');
        return;
      }
      logger.warn('Quest completor pass failed unexpectedly.', error);
    } finally {
      running = false;
    }
  };

  void run();
  setInterval(() => {
    void run();
  }, intervalMs);

  logger.info(`Quest completor enabled. Checking quests every ${Math.round(intervalMs / 1000)}s.`);
}
