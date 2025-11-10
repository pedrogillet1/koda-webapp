/** WebSocket Service - Real-time event emission */
import { io } from '../server';

class WebSocketService {
  emit(event: string, data: any) {
    io.emit(event, data);
    return true;
  }

  broadcast(event: string, data: any) {
    io.emit(event, data);
    return true;
  }

  sendToUser(userId: string, event: string, data: any) {
    io.to(`user:${userId}`).emit(event, data);
    return true;
  }
}

export const emitDocumentEvent = (userId: string, event: string, documentId?: string) => {
  console.log(`📡 [WebSocket] Emitting document-${event} to user ${userId.substring(0, 8)}...`, documentId ? `(doc: ${documentId.substring(0, 8)}...)` : '');

  // Emit generic documents-changed event for UI refresh
  io.to(`user:${userId}`).emit('documents-changed', { event, documentId });

  // Emit specific event based on action
  if (event === 'created') {
    io.to(`user:${userId}`).emit('document-created', { documentId });
  } else if (event === 'deleted') {
    io.to(`user:${userId}`).emit('document-deleted', { documentId });
  } else if (event === 'moved') {
    io.to(`user:${userId}`).emit('document-moved', { documentId });
  } else if (event === 'updated') {
    io.to(`user:${userId}`).emit('document-updated', { documentId });
  }

  return true;
};

export const emitFolderEvent = (userId: string, event: string, folderId?: string) => {
  console.log(`📡 [WebSocket] Emitting folder-${event} to user ${userId.substring(0, 8)}...`, folderId ? `(folder: ${folderId.substring(0, 8)}...)` : '');

  // Emit generic folders-changed event for UI refresh
  io.to(`user:${userId}`).emit('folders-changed', { event, folderId });

  // Emit specific event based on action
  if (event === 'created') {
    io.to(`user:${userId}`).emit('folder-created', { folderId });
  } else if (event === 'deleted') {
    io.to(`user:${userId}`).emit('folder-deleted', { folderId });
  }

  return true;
};

export const emitToUser = (userId: string, event: string, data: any) => {
  console.log(`📡 [WebSocket] Emitting ${event} to user ${userId.substring(0, 8)}...`);
  io.to(`user:${userId}`).emit(event, data);
  return true;
};

export const getIO = () => {
  return io;
};

export default new WebSocketService();
