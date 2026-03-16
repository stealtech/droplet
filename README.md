<div align="center">
  <img src="./assets/droplet-assets/droplet-icon.png" alt="Droplet project logo" width="120" />

  <h2>Droplet</h2>
  <p>A Bun-powered Discord selfbot utility with an optional bridge app bot, rich user tools, admin actions, slash relays, and quest automation.</p>

  <p>
    <img alt="Bun" src="https://img.shields.io/badge/runtime-Bun-f9f1e1?style=for-the-badge&logo=bun&logoColor=000000" />
    <img alt="TypeScript" src="https://img.shields.io/badge/language-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
    <img alt="discord.js" src="https://img.shields.io/badge/library-discord.js-5865F2?style=for-the-badge&logo=discord&logoColor=white" />
    <img alt="Components V2" src="https://img.shields.io/badge/UI-Components%20V2-5865F2?style=for-the-badge&logo=discord&logoColor=white" />
    <img alt="Zod Config Validation" src="https://img.shields.io/badge/config-Zod-3068B7?style=for-the-badge&logo=zod&logoColor=white" />
  </p>
</div>

> [!WARNING]
> Selfbots are against Discord's Terms of Service and can put accounts at risk.
> Use this project only if you fully understand that risk. Never publish real tokens,
> and never commit your live `config.yaml`.

## Overview

Droplet splits responsibilities between two clients:

- A selfbot account performs the actual user, guild, slash, and quest actions.
- An optional app bot exposes safer slash-command UX with ephemeral Components V2
  responses.
- A typed YAML config controls features, safety rules, presets, presence, startup
  tasks, and bridge access.

This repo also includes a local fork of `discord.js-selfbot-v13` in
`selfbot-v13/`, which is used as the selfbot runtime.

## Features

- Rich user tooling for profile info, avatars, banners, mutual data, badges,
  ReviewDB lookups, UserPFP lookups, and connections.
- Optional bridge app bot with ephemeral slash commands and dynamic help menus.
- Admin command suite routed through the bridge bot but executed by the selfbot.
- Slash relay and preset execution for bots that require interaction-based flows.
- Startup application emoji syncing from local assets.
- Quest auto-completor with optional auto-enroll and periodic progress updates.
- Presence and platform spoof configuration.
- Styled terminal output with a branded startup banner and colored logs.

## Architecture

| Part           | Role                                                                                              |
| -------------- | ------------------------------------------------------------------------------------------------- |
| `selfbot`      | Executes prefix commands, guild actions, user lookups, quest actions, and slash relays.           |
| `appBot`       | Optional slash-command bridge with Components V2 responses and access control.                    |
| `config.yaml`  | Single source of truth for tokens, enabled features, safety gates, presets, and startup behavior. |
| `assets/`      | Local art and badge icon assets used for startup UI and emoji syncing.                            |
| `selfbot-v13/` | Bundled local dependency that powers the selfbot client.                                          |

## Commands

### Prefix commands

| Command         | Purpose                                                           |
| --------------- | ----------------------------------------------------------------- |
| `help`          | Shows enabled command groups and usage.                           |
| `ping`          | Returns basic bot latency and status info.                        |
| `user`          | Fetches rich profile data, avatars, or banners for a target user. |
| `preset <name>` | Executes a configured slash preset from `config.yaml`.            |

### Bridge slash commands

| Command                 | Purpose                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `/help`                 | Category-based interactive help menu.                       |
| `/ping`                 | Ephemeral status response.                                  |
| `/user info`            | Rich user profile view with action buttons.                 |
| `/user avatar`          | Shows a target user's avatar.                               |
| `/user banner`          | Shows a target user's banner.                               |
| `/preset name:<preset>` | Runs a configured slash preset through the selfbot account. |
| `/admin ...`            | Runs admin utilities through the bridge bot.                |

### Admin subcommands

`/admin` currently includes:

- `addallroles`
- `ban`
- `bans`
- `createchannel`
- `hackban`
- `kick`
- `nuke`
- `purge`
- `removeallroles`
- `removetimeout`
- `slowmode`
- `softban`
- `timeout`
- `unban`

## Requirements

- Bun 1.x
- A Discord user token for the selfbot client
- An optional Discord application + bot token for bridge slash commands
- A target guild for bridge command registration if `appBot.enabled` is `true`

## Quick Start

### 1. Install dependencies

```bash
bun install
```

### 2. Configure `config.yaml`

Use placeholder values and keep the real file private:

```yaml
selfbot:
  token: YOUR_USER_TOKEN
  commandPrefix: "-"
  logLevel: info
  deleteCommandMessage: false

appBot:
  enabled: true
  token: YOUR_APP_BOT_TOKEN
  clientId: YOUR_APPLICATION_CLIENT_ID
  guildId: YOUR_GUILD_ID
  registerCommandsOnStartup: true
  allowedUserIds:
    - YOUR_USER_ID

features:
  prefixCommands: true
  help: true
  ping: true
  userInfo: true
  slash: true
  preset: true
  admin: true

startup:
  syncApplicationEmojisOnStartup: true
  applicationEmojiDirectory: ./assets/
  questCompletor:
    enabled: false
    checkIntervalMs: 120000
    autoEnroll: true
    videoProgressStepSeconds: 15
```

### 3. Start the project

```bash
bun run start
```

### 4. Type-check changes

```bash
bun run typecheck
```

## Configuration Notes

- `appBot.allowedUserIds` restricts who can use bridge slash commands.
- `safety.runCommandsFromSelfOnly` helps prevent accidental prefix execution from
  other users.
- `slash.presets` lets you store reusable slash-command payloads for the
  `preset` command.
- `startup.syncApplicationEmojisOnStartup` scans the configured asset directory
  and uploads application emojis for badge rendering.
- `startup.questCompletor` controls periodic quest checks and progress behavior.
- `accountSpoof` and `presence` control how the self account appears after login.

## Project Layout

```text
src/
  bot.ts
  commands/
  types/
utils/
assets/
selfbot-v13/
config.yaml
index.ts
```

## Safety

- Do not commit real tokens or personally identifiable config values.
- Prefer a private test guild before enabling admin actions in production-like
  servers.
- Keep `allowedUserIds` narrow when the bridge bot is enabled.
- Review Discord changes carefully before relying on quest automation or
  selfbot-only endpoints.

## Development

- Runtime entrypoint: `index.ts`
- Main orchestrator: `src/bot.ts`
- Config schema: `utils/ConfigUtil.ts`
- Command registry: `src/commands/index.ts`
- Quest automation: `utils/QuestUtil.ts`

If you add new bridge commands, update the command metadata so `/help` categories
stay accurate automatically.

## Credits

- Built on `discord.js` and the bundled `discord.js-selfbot-v13` fork.
- Uses `yaml` and `zod` for typed config loading and validation.
- Uses local badge assets plus application emoji syncing for richer user output.
