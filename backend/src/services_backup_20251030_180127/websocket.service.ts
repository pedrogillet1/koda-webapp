/** WebSocket Service - Minimal Stub */
class WebSocketService {
  emit(event: string, data: any) { console.log(`[WS STUB] ${event}:`, data); }
  to(room: string) { return this; }
}
export default new WebSocketService();
