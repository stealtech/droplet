import type { BotConfig } from '../types/Config';

const platformToBrowser: Record<BotConfig['accountSpoof']['platform'], string> = {
  desktop: 'Discord Client',
  web: 'Discord Web',
  ios: 'Discord iOS',
  android: 'Discord Android',
  xbox: 'Discord Embedded',
  playstation: 'Discord Embedded',
  vr: 'Discord VR',
};

export function getSpoofedBrowser(config: BotConfig): string | undefined {
  if (!config.accountSpoof.enabled) {
    return undefined;
  }

  if (config.accountSpoof.customBrowser?.trim()) {
    return config.accountSpoof.customBrowser.trim();
  }

  return platformToBrowser[config.accountSpoof.platform];
}
