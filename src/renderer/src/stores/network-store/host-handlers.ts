import * as hostManager from '../../network/host-manager'
import { broadcastExcluding } from '../../network/host-manager'
import { getPeerId } from '../../network/peer-manager'
import type { MessageType, NetworkMessage, ShopItem } from '../../network/types'
import type { NetworkState } from './index'

// Lazy accessors to break circular dependency (network-store -> game/lobby-store -> network-store)
function getGameStore() {
  return (require('../use-game-store') as typeof import('../use-game-store')).useGameStore
}
function getLobbyStore() {
  return (require('../use-lobby-store') as typeof import('../use-lobby-store')).useLobbyStore
}

/**
 * Handle messages received by the host from connected peers.
 * Routes messages and rebroadcasts as needed.
 */
export function handleHostMessage(
  message: NetworkMessage,
  fromPeerId: string,
  get: () => NetworkState,
  _set: (partial: Partial<NetworkState> | ((state: NetworkState) => Partial<NetworkState>)) => void
): void {
  switch (message.type) {
    case 'player:ready': {
      const readyPayload = message.payload as { isReady?: boolean }
      get().updatePeer(fromPeerId, { isReady: readyPayload.isReady ?? true })
      broadcastExcluding(message, fromPeerId)
      break
    }

    case 'player:character-select': {
      const payload = message.payload as { characterId: string | null; characterName: string | null }
      get().updatePeer(fromPeerId, {
        characterId: payload.characterId,
        characterName: payload.characterName
      })
      broadcastExcluding(message, fromPeerId)
      break
    }

    case 'voice:mute-toggle': {
      const payload = message.payload as { peerId: string; isMuted: boolean }
      get().updatePeer(fromPeerId, { isMuted: payload.isMuted })
      broadcastExcluding(message, fromPeerId)
      break
    }

    case 'voice:deafen-toggle': {
      const payload = message.payload as { peerId: string; isDeafened: boolean }
      get().updatePeer(fromPeerId, { isDeafened: payload.isDeafened })
      getLobbyStore().getState().updatePlayer(fromPeerId, { isDeafened: payload.isDeafened })
      broadcastExcluding(message, fromPeerId)
      break
    }

    case 'chat:message': {
      broadcastExcluding(message, fromPeerId)
      break
    }

    case 'chat:file': {
      broadcastExcluding(message, fromPeerId)
      break
    }

    case 'player:color-change': {
      const colorPayload = message.payload as { color: string }
      get().updatePeer(fromPeerId, { color: colorPayload.color })
      getLobbyStore().getState().updatePlayer(fromPeerId, { color: colorPayload.color })
      hostManager.updatePeerInfo(fromPeerId, { color: colorPayload.color })
      broadcastExcluding(message, fromPeerId)
      break
    }

    case 'chat:whisper': {
      const payload = message.payload as { message: string; targetPeerId: string; targetName?: string }
      const localId = getPeerId()

      // If targeted at the host, display it locally
      if (payload.targetPeerId === localId) {
        getLobbyStore()
          .getState()
          .addChatMessage({
            id: `whisper-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
            senderId: message.senderId,
            senderName: `${message.senderName} (Whisper)`,
            content: payload.message,
            timestamp: Date.now(),
            isSystem: false
          })
      } else {
        // Forward whisper only to the target, after validating they exist
        const targetInfo = hostManager.getPeerInfo(payload.targetPeerId)
        if (targetInfo) {
          ;(message.payload as Record<string, unknown>).targetName = targetInfo.displayName
          hostManager.sendToPeer(payload.targetPeerId, message)
        }
      }
      break
    }

    case 'game:dice-roll': {
      broadcastExcluding(message, fromPeerId)
      break
    }

    case 'player:buy-item': {
      const buyPayload = message.payload as { itemId: string; itemName: string }
      {
        const gameStore = getGameStore().getState()
        const updatedInventory = gameStore.shopInventory.map((item: ShopItem) => {
          if (item.id !== buyPayload.itemId) return item
          const updates: Partial<ShopItem> = {}
          if (item.quantity > 0) updates.quantity = item.quantity - 1
          if (item.stockRemaining != null && item.stockRemaining > 0) updates.stockRemaining = item.stockRemaining - 1
          return { ...item, ...updates }
        })
        gameStore.setShopInventory(updatedInventory)
        hostManager.broadcastMessage({
          type: 'dm:shop-update' as MessageType,
          payload: { shopInventory: updatedInventory, shopName: gameStore.shopName },
          senderId: getPeerId() || '',
          senderName: get().displayName,
          timestamp: Date.now(),
          sequence: 0
        })
      }
      broadcastExcluding(message, fromPeerId)
      break
    }
    case 'player:sell-item': {
      const sellPayload = message.payload as {
        itemName: string
        price: { cp?: number; sp?: number; gp?: number; pp?: number }
      }
      {
        const gameStore = getGameStore().getState()
        const existing = gameStore.shopInventory.find(
          (item: ShopItem) => item.name.toLowerCase() === sellPayload.itemName.toLowerCase()
        )
        let updatedInventory: ShopItem[]
        if (existing) {
          updatedInventory = gameStore.shopInventory.map((item: ShopItem) =>
            item.id === existing.id
              ? {
                  ...item,
                  quantity: item.quantity + 1,
                  stockRemaining: item.stockRemaining != null ? item.stockRemaining + 1 : undefined
                }
              : item
          )
        } else {
          const newItem: ShopItem = {
            id: crypto.randomUUID(),
            name: sellPayload.itemName,
            category: 'other',
            price: sellPayload.price,
            quantity: 1,
            shopCategory: 'other'
          }
          updatedInventory = [...gameStore.shopInventory, newItem]
        }
        gameStore.setShopInventory(updatedInventory)
        hostManager.broadcastMessage({
          type: 'dm:shop-update' as MessageType,
          payload: { shopInventory: updatedInventory, shopName: gameStore.shopName },
          senderId: getPeerId() || '',
          senderName: get().displayName,
          timestamp: Date.now(),
          sequence: 0
        })
      }
      broadcastExcluding(message, fromPeerId)
      break
    }

    default: {
      // Other messages from clients get rebroadcast by default
      // The host can decide which to relay
      break
    }
  }
}
