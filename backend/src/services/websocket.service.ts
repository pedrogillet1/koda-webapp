/** WebSocket Service - Minimal Stub (Non-MVP) */
class WebSocketService {
  emit(event: string, data: any) { return true; }
  broadcast(event: string, data: any) { return true; }
  sendToUser(userId: string, event: string, data: any) { return true; }
}

export const emitDocumentEvent = (event: string, data: any) => {
  // Stub: Would emit document events via WebSocket
  return true;
};

export const emitFolderEvent = (userId: string, event: string, folderId?: string) => {
  // Stub: Would emit folder events via WebSocket
  return true;
};

export const emitToUser = (userId: string, event: string, data: any) => {
  // Stub: Would emit to specific user via WebSocket
  return true;
};

export const getIO = () => {
  // Stub: Would return socket.io instance
  return null;
};

export default new WebSocketService();
