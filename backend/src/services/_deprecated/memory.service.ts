/**
 * Memory Service - STUB (service removed)
 * This stub file prevents import errors while the service is removed.
 */

export const getMemories = async () => [];

export const addMemory = async () => {
  throw new Error('Memory service removed');
};

export const deleteMemory = async () => {};

export const searchMemories = async () => [];

export const getRelevantMemories = async (_userId: string, _query: string, _section?: string, _limit?: number) => [];

export default {
  getMemories,
  addMemory,
  deleteMemory,
  searchMemories,
  getRelevantMemories,
};
