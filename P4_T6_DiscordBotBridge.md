# P4_T6: Discord Bot Bridge Integration

## Overview

This document describes the Discord Bot Bridge integration that forwards AI-generated DM narration from the VTT application to Discord for remote play and notifications.

## Files Created/Modified

### New Files

1. **`src/main/discord-integration/discord-service.ts`**
   - Core service for Discord integration
   - Secure storage for bot tokens and webhook URLs
   - Text filtering to remove technical metadata
   - Support for both webhook and bot API modes

2. **`src/main/discord-integration/index.ts`**
   - Module exports for Discord integration

3. **`src/main/discord-integration/discord-service.test.ts`**
   - Unit tests for Discord service (19 tests)

4. **`src/main/ipc/discord-handlers.ts`**
   - IPC handlers for Discord configuration and messaging

5. **`src/renderer/src/components/ui/DiscordIntegrationSettings.tsx`**
   - React component for Discord settings UI

### Modified Files

1. **`src/shared/ipc-channels.ts`**
   - Added 4 new IPC channels:
     - `DISCORD_GET_CONFIG`
     - `DISCORD_SAVE_CONFIG`
     - `DISCORD_TEST_CONNECTION`
     - `DISCORD_SEND_MESSAGE`

2. **`src/main/ipc/index.ts`**
   - Registered Discord IPC handlers

3. **`src/preload/index.ts`**
   - Added `window.api.discord` API with:
     - `getConfig()`
     - `saveConfig(config)`
     - `testConnection()`
     - `sendMessage(text, campaignName)`

4. **`src/main/ai/ai-service.ts`**
   - Added Discord forwarding in `handleStreamCompletion()`
   - Narration is sent to Discord after being finalized (non-blocking)

5. **`src/renderer/src/pages/SettingsPage.tsx`**
   - Added Discord Integration section after Ollama AI section

## Features

### 1. Secure Configuration Storage

The Discord bot token and webhook URL are stored securely in the application's user data directory:

- **Location**: `{userData}/discord-integration.json`
- **Format**: JSON with fields:
  - `enabled`: Boolean toggle
  - `botToken`: Discord bot token (for bot API mode)
  - `webhookUrl`: Discord webhook URL (for webhook mode)
  - `channelId`: Optional channel ID (future use)
  - `userId`: Discord user ID to receive DMs (for bot API mode)
  - `dmMode`: Either `'webhook'` or `'bot-api'`

### 2. Two Integration Modes

#### Webhook Mode
- Uses Discord webhook URLs
- Sends messages to a channel
- No bot token required
- Easier setup (just copy webhook URL from Discord)

#### Bot API Mode
- Uses Discord bot token + user ID
- Sends DMs directly to a specific user
- Requires:
  - Bot token from Discord Developer Portal
  - Bot to be in a shared guild with the user
  - User ID (with Developer Mode enabled)

### 3. "Push to Discord" Toggle

Located in Settings → Discord Integration:

- Enable/disable toggle
- Mode selection (Webhook or Bot DM)
- Configuration fields based on mode
- Test connection button
- Save/reset functionality

### 4. Technical Metadata Filtering

The `cleanTextForDiscord()` function automatically removes:

- `[DM_ACTIONS]...[\/DM_ACTIONS]` blocks
- `[STAT_CHANGES]...[\/STAT_CHANGES]` blocks
- `[RULE_CITATION]...[\/RULE_CITATION]` blocks
- `[FILE_READ]...[\/FILE_READ]` tags
- `[WEB_SEARCH]...[\/WEB_SEARCH]` tags
- `[PROVIDER_CONTEXT]...[\/PROVIDER_CONTEXT]` blocks

Only clean narrative text is sent to Discord.

### 5. Automatic Forwarding

When enabled, AI DM narration is automatically forwarded to Discord:

- Happens after stream completion (non-blocking)
- Only the `displayText` (cleaned) is sent
- Campaign name is included as the username/prefix
- Errors are logged but don't block the VTT chat

## Usage

### Setup (Webhook Mode - Recommended)

1. Go to your Discord server
2. Open channel settings → Integrations → Webhooks
3. Create a new webhook and copy the URL
4. In the VTT app, go to Settings → Discord Integration
5. Enable "Push to Discord"
6. Select "Webhook" mode
7. Paste the webhook URL
8. Click "Save Settings"
9. Click "Test Connection" to verify

### Setup (Bot API Mode)

1. Go to Discord Developer Portal (https://discord.com/developers/applications)
2. Create a new application and bot
3. Copy the bot token
4. Enable Developer Mode in Discord (Settings → Advanced)
5. Right-click your user profile → Copy User ID
6. Ensure the bot is in a shared guild with you
7. In the VTT app, go to Settings → Discord Integration
8. Enable "Push to Discord"
9. Select "Bot DM" mode
10. Enter bot token and user ID
11. Click "Save Settings"
12. Click "Test Connection" to verify

## Testing

Run the Discord integration tests:

```bash
npx vitest run src/main/discord-integration/discord-service.test.ts
```

Tests cover:
- Configuration validation
- Config preview (masked values)
- Text cleaning for all metadata types
- Edge cases (empty text, no tags, etc.)

## Success Criteria

✅ When the AI DM generates a room description, the text appears simultaneously in:
- The VTT chat interface
- The specified Discord channel or DM

✅ Technical metadata is filtered out:
- [DM_ACTIONS], [STAT_CHANGES], [RULE_CITATION], etc. are not visible in Discord

✅ Configuration is secure:
- Tokens/URLs stored in user data directory
- Masked in UI (show as `[configured]`)
- Only updated when explicitly changed

## Technical Notes

### Security Considerations
- Bot tokens and webhook URLs are stored locally
- They are not transmitted to any external service except Discord
- The UI masks sensitive values after saving
- Special 'keep' value preserves existing tokens when saving

### Message Limits
- Discord has a 2000 character message limit
- Long messages are automatically truncated with an indicator
- Messages are cleaned of excessive whitespace

### Error Handling
- Discord send failures are logged but don't block VTT chat
- Invalid configurations are rejected with descriptive errors
- Test connection button validates setup before use

## Future Enhancements

Potential improvements:
- Support for Discord embeds (rich formatting)
- Configurable message templates
- Image/map sharing to Discord
- Bidirectional messaging (Discord → VTT)
- Role-based permissions for different notification types
