// Types
export type {
  ConnectionState,
  MessageType,
  NetworkMessage,
  PeerInfo,
  JoinPayload,
  ChatPayload,
  WhisperPayload,
  DiceRollPayload,
  DiceResultPayload,
  StateUpdatePayload,
  TokenMovePayload,
  FogRevealPayload,
  MapChangePayload,
  CharacterSelectPayload,
  InitiativeUpdatePayload,
  ConditionUpdatePayload,
  KickPayload,
  MuteTogglePayload
} from './types'

// Peer manager
export {
  createPeer,
  destroyPeer,
  generateInviteCode,
  getPeerId,
  getPeer
} from './peer-manager'

// Host manager
export {
  startHosting,
  stopHosting,
  broadcastMessage,
  sendToPeer,
  kickPeer,
  getConnectedPeers,
  onPeerJoined,
  onPeerLeft,
  onMessage as onHostMessage,
  isHosting,
  getInviteCode
} from './host-manager'

// Client manager
export {
  connectToHost,
  disconnect,
  sendMessage as sendClientMessage,
  onMessage as onClientMessage,
  onDisconnected,
  isConnected
} from './client-manager'

// Message handler
export { createMessageRouter } from './message-handler'

// Voice manager
export {
  startVoice,
  stopVoice,
  callPeer,
  answerCall,
  setMuted,
  setDeafened,
  isSpeaking,
  isMuted,
  isDeafened,
  onSpeakingChange,
  removePeer as removeVoicePeer
} from './voice-manager'
