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

export default new WebSocketService();
