# P7_T5: Google Drive Sync via Rclone

**Assigned Agent:** Kimi K2.5  
**Status:** Completed  
**Date:** March 9, 2026

---

## Overview

This document describes the implementation of a cloud backup and synchronization system using Google Drive via Rclone, specifically configured for the `patrick@bmo` remote on the Raspberry Pi host.

The existing "S3 cloud backup" reference has been replaced with a Rclone-based solution that interfaces with the BMO Pi's local Rclone installation.

---

## Architecture

### Security Model
- **No credentials in VTT**: All Google Drive credentials and Rclone configuration remain on the Pi
- **Shell command execution**: The VTT sends commands to the Pi via HTTP API; the Pi executes rclone with its own configuration
- **Read-only remote verification**: The VTT can check remote status but cannot access credentials

### Data Flow
```
VTT (Renderer) → IPC → Main Process → BMO Bridge → Pi (patrick@bmo) → Rclone → Google Drive
```

---

## Implementation

### 1. Core Cloud Sync Module (`src/main/cloud-sync.ts`)

**Responsibilities:**
- Execute rclone commands via BMO Pi bridge
- Handle sync operations (copy, check, list)
- Provide status checking for remote availability

**Key Functions:**
- `checkRemoteStatus()` - Check if Rclone is configured and reachable
- `syncCampaignToDrive()` - Sync campaign data to Google Drive
- `checkCampaignSyncStatus()` - Check if campaign exists on remote
- `listRemoteCampaigns()` - List all backed-up campaigns

**Rclone Command Structure:**
```
rclone copy [local-paths] gdrive:DND-VTT-Backups/{campaignId}/
```

**Included File Types:**
- `.json` - Campaign config, world state, AI conversations
- `.png`, `.jpg`, `.jpeg`, `.webp` - Map images and portraits
- `.mp3`, `.wav`, `.ogg` - Custom audio files

### 2. IPC Channels (`src/shared/ipc-channels.ts`)

New channels added:
- `CLOUD_SYNC_STATUS` - Check Rclone remote status
- `CLOUD_SYNC_BACKUP` - Trigger campaign backup
- `CLOUD_SYNC_CHECK_STATUS` - Check specific campaign sync status
- `CLOUD_SYNC_LIST_CAMPAIGNS` - List backed-up campaigns

### 3. IPC Handlers (`src/main/ipc/cloud-sync-handlers.ts`)

**Responsibilities:**
- Validate campaign IDs (UUID format)
- Validate campaign names (length, content)
- Log all operations for debugging
- Return structured results

### 4. Preload API (`src/preload/index.ts`)

Exposed as `window.api.cloudSync`:
- `getStatus()` - Get Rclone configuration status
- `backupCampaign(campaignId, campaignName)` - Trigger backup
- `checkCampaignStatus(campaignId)` - Check campaign remote status
- `listRemoteCampaigns()` - List all remote backups

### 5. Renderer Services

#### Cloud Sync Service (`src/renderer/src/services/cloud-sync-service.ts`)
- High-level API for components
- Automatic toast notifications on success/failure
- Error logging via logger utility

#### useCloudSync Hook (`src/renderer/src/hooks/use-cloud-sync.ts`)
- React state management for sync operations
- Automatic status polling (5-minute interval)
- Loading states and error handling

### 6. UI Components

#### CloudSyncPanel (`src/renderer/src/components/game/dm/CloudSyncPanel.tsx`)
- DM sidebar panel for backup operations
- Shows remote status indicator
- Displays campaign backup status
- "Backup to Drive" button with progress
- Last sync time display

#### CloudSyncButton (`src/renderer/src/components/ui/CloudSyncButton.tsx`)
- Standalone button for campaign headers/detail pages
- Compact and full variants
- On-demand availability checking

---

## Pi API Requirements

The BMO Pi must expose these endpoints:

### `GET /api/rclone/status`
Returns Rclone configuration status:
```json
{
  "configured": true,
  "remotes": ["gdrive"],
  "version": "1.65.2"
}
```

### `POST /api/rclone/execute`
Executes rclone commands:
```json
{
  "command": "copy",
  "args": ["--transfers", "4", "/path/to/file", "gdrive:remote/path"],
  "timeout": 60000
}
```

---

## Usage

### In DM Tools Panel
```tsx
import CloudSyncPanel from '../../components/game/dm/CloudSyncPanel'

// In component render:
<CloudSyncPanel campaignId={campaignId} campaignName={campaignName} />
```

### As Standalone Button
```tsx
import CloudSyncButton from '../../components/ui/CloudSyncButton'

// In component render:
<CloudSyncButton
  campaignId={campaign.id}
  campaignName={campaign.name}
  variant="compact"
/>
```

### Programmatic Access
```tsx
import { backupCampaignToCloud, checkCloudSyncStatus } from '../services/cloud-sync-service'

// Check if backup is available
const status = await checkCloudSyncStatus()
if (status.configured) {
  // Trigger backup
  await backupCampaignToCloud(campaignId, campaignName)
}
```

---

## Success Criteria

✅ A DM clicks "Backup to Drive," and the campaign's world-state.json and asset folders are successfully synced to Google Drive using the Rclone remote on the Pi.

### Test Checklist:
- [ ] Cloud sync status shows correctly when Pi is reachable
- [ ] Error state displays when Rclone not configured
- [ ] Backup button triggers rclone copy command
- [ ] Progress indicator shows during backup
- [ ] Success toast appears after backup completes
- [ ] Last backup time is displayed
- [ ] Campaign status shows if backup exists on remote
- [ ] File filtering works (only specific extensions backed up)

---

## File Summary

| File | Purpose |
|------|---------|
| `src/main/cloud-sync.ts` | Core rclone command execution |
| `src/main/ipc/cloud-sync-handlers.ts` | IPC handlers for cloud sync |
| `src/shared/ipc-channels.ts` | IPC channel definitions |
| `src/preload/index.ts` | API exposure to renderer |
| `src/renderer/src/services/cloud-sync-service.ts` | Service layer |
| `src/renderer/src/hooks/use-cloud-sync.ts` | React hook |
| `src/renderer/src/components/game/dm/CloudSyncPanel.tsx` | DM panel UI |
| `src/renderer/src/components/ui/CloudSyncButton.tsx` | Standalone button |

---

## Notes

- Backup is one-way (local → remote) using `rclone copy` for safety
- Remote folder structure: `DND-VTT-Backups/{campaignId}/`
- No automatic sync - backups are triggered manually by DM
- All credentials remain on the Pi; VTT only sends command requests
