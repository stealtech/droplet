import type { LogLevel } from '../types/Config';
import { inspect } from 'node:util';

const levelWeight: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const ansi = {
  reset: '\u001B[0m',
  bold: '\u001B[1m',
  dim: '\u001B[2m',
  cyan: '\u001B[36m',
  blue: '\u001B[38;5;39m',
  sky: '\u001B[38;5;81m',
  teal: '\u001B[38;5;45m',
  green: '\u001B[38;5;42m',
  yellow: '\u001B[38;5;221m',
  red: '\u001B[38;5;203m',
  gray: '\u001B[38;5;245m',
  panel: '\u001B[38;5;67m',
  border: '\u001B[38;5;31m',
};

function supportsColor(): boolean {
  return Boolean(process.stdout.isTTY);
}

function paint(value: string, ...codes: string[]): string {
  if (!supportsColor()) {
    return value;
  }

  return `${codes.join('')}${value}${ansi.reset}`;
}

function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-9;]*m/g, '');
}

function visibleLength(value: string): number {
  return stripAnsi(value).length;
}

function center(value: string, width = process.stdout.columns || 80): string {
  const padding = Math.max(0, Math.floor((width - visibleLength(value)) / 2));
  return `${' '.repeat(padding)}${value}`;
}

function centerMultiline(value: string, width = process.stdout.columns || 80): string {
  return value
    .split('\n')
    .map(line => (line ? center(line, width) : line))
    .join('\n');
}

function padRight(value: string, width: number): string {
  const visible = visibleLength(value);
  return visible >= width ? value : `${value}${' '.repeat(width - visible)}`;
}

function formatLevel(level: LogLevel): string {
  switch (level) {
    case 'debug':
      return paint('DEBUG', ansi.cyan, ansi.bold);
    case 'info':
      return paint('INFO ', ansi.green, ansi.bold);
    case 'warn':
      return paint('WARN ', ansi.yellow, ansi.bold);
    case 'error':
      return paint('ERROR', ansi.red, ansi.bold);
    default:
      return 'LOG  ';
  }
}

function formatTimestamp(date = new Date()): string {
  const time = date.toISOString().replace('T', ' ').replace('Z', ' UTC');
  return paint(time, ansi.gray);
}

export async function renderStartupBanner(): Promise<void> {
  const width = Math.min(Math.max(process.stdout.columns || 80, 64), 96);
  const panelWidth = Math.min(Math.max(width - 18, 44), 68);
  const top = `╭${'─'.repeat(panelWidth + 2)}╮`;
  const bottom = `╰${'─'.repeat(panelWidth + 2)}╯`;
  const dropletArt = [
    '                                      ',
    '                    +=+               ',
    '                 -=++*                ',
    '               --*#++                 ',
    '              --+*=+#                 ',
    '             -:+#*==*                 ',
    '            :.+#%#*==*                ',
    '           ::-*%##**===*              ',
    '           ::+%##*+++*+++*            ',
    '          ::-###*++++++*#**           ',
    '         --:+##**+++++++*#%##         ',
    '         --=+***+++++++++*###         ',
    '        =--+*+*++++++++++#%%#         ',
    '        =--*#%*++++++++*#%%%**        ',
    '         -=+%%%%%%%%%@@@@%%%**        ',
    '         ==+*%#%%%%%%%%@@@#*#         ',
    '           =**###*#********#          ',
    '            ++**#%%####*###           ',
    '               +***#%##               ',
    '                                      ',
  ]
    .map(line => paint(line, ansi.teal, ansi.bold))
    .join('\n');
  const title = center(paint('DROPLET CONTROL TERMINAL', ansi.blue, ansi.bold), width);
  const panelLine = (text = '') => {
    const padded = padRight(text, panelWidth);
    return center(`${paint('│', ansi.border)} ${padded} ${paint('│', ansi.border)}`, width);
  };

  process.stdout.write('\u001Bc');
  console.log('');

  console.log(centerMultiline(dropletArt, width));

  console.log(title);
  console.log('');
  console.log(center(paint(top, ansi.border), width));
  console.log(panelLine(paint('          Clean boot • colored logs • live status stream', ansi.panel)));
  console.log(center(paint(bottom, ansi.border), width));
  console.log('');
}

function shouldLog(current: LogLevel, target: LogLevel): boolean {
  return levelWeight[target] >= levelWeight[current];
}

function write(level: LogLevel, message: string, details?: unknown): void {
  const prefix = `${formatTimestamp()} ${paint('│', ansi.border)} ${formatLevel(level)}`;
  if (details === undefined) {
    console.log(`${prefix} ${message}`);
    return;
  }

  console.log(`${prefix} ${message}`);
  console.log(
    paint(
      inspect(details, {
        colors: supportsColor(),
        depth: 6,
        breakLength: 100,
        compact: false,
      }),
      ansi.dim,
    ),
  );
}

export function createLogger(currentLevel: LogLevel) {
  return {
    debug(message: string, details?: unknown) {
      if (shouldLog(currentLevel, 'debug')) write('debug', message, details);
    },
    info(message: string, details?: unknown) {
      if (shouldLog(currentLevel, 'info')) write('info', message, details);
    },
    warn(message: string, details?: unknown) {
      if (shouldLog(currentLevel, 'warn')) write('warn', message, details);
    },
    error(message: string, details?: unknown) {
      if (shouldLog(currentLevel, 'error')) write('error', message, details);
    },
  };
}