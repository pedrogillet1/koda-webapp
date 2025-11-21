/**
 * Memory API Routes
 * Endpoints for managing cross-session user memories
 */

import { Router, Request, Response } from 'express';
import { MemorySection } from '@prisma/client';
import * as memoryService from '../services/memory.service';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

/**
 * GET /api/memories
 * List all memories for the authenticated user
 * Query params:
 *   - section: Filter by memory section (optional)
 *   - limit: Number of memories to return (optional, default: 100)
 */
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const section = req.query.section as MemorySection | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;

    console.log(`=Ú [MEMORY API] GET /api/memories - User: ${userId.substring(0, 8)}...`);

    const memories = await memoryService.getUserMemories(userId, section, limit);

    // Get memory statistics
    const stats = await memoryService.getMemoryStats(userId);

    res.json({
      success: true,
      memories,
      stats,
      count: memories.length
    });
  } catch (error: any) {
    console.error('L [MEMORY API] Error fetching memories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch memories',
      message: error.message
    });
  }
});

/**
 * POST /api/memories
 * Create a new memory
 * Body:
 *   - section: Memory section (required)
 *   - content: Memory content (required)
 *   - importance: Importance score 1-10 (optional, default: 5)
 *   - source: Source of the memory (optional)
 *   - metadata: Additional metadata (optional)
 */
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { section, content, importance, source, metadata } = req.body;

    // Validation
    if (!section || !content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'section and content are required'
      });
    }

    if (!Object.values(MemorySection).includes(section)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid memory section',
        message: `Section must be one of: ${Object.values(MemorySection).join(', ')}`
      });
    }

    if (importance !== undefined && (importance < 1 || importance > 10)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid importance score',
        message: 'Importance must be between 1 and 10'
      });
    }

    console.log(`=¾ [MEMORY API] POST /api/memories - User: ${userId.substring(0, 8)}... (${section})`);

    const memory = await memoryService.createMemory({
      userId,
      section,
      content,
      importance,
      source,
      metadata
    });

    res.status(201).json({
      success: true,
      memory
    });
  } catch (error: any) {
    console.error('L [MEMORY API] Error creating memory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create memory',
      message: error.message
    });
  }
});

/**
 * PUT /api/memories/:memoryId
 * Update an existing memory
 * Body:
 *   - content: Updated content (optional)
 *   - importance: Updated importance score (optional)
 *   - metadata: Updated metadata (optional)
 */
router.put('/:memoryId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { memoryId } = req.params;
    const { content, importance, metadata } = req.body;

    // Validate importance if provided
    if (importance !== undefined && (importance < 1 || importance > 10)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid importance score',
        message: 'Importance must be between 1 and 10'
      });
    }

    console.log(` [MEMORY API] PUT /api/memories/${memoryId} - User: ${userId.substring(0, 8)}...`);

    // Verify memory belongs to user
    const existingMemories = await memoryService.getUserMemories(userId);
    const memoryExists = existingMemories.some(m => m.id === memoryId);

    if (!memoryExists) {
      return res.status(404).json({
        success: false,
        error: 'Memory not found',
        message: 'Memory does not exist or does not belong to this user'
      });
    }

    const memory = await memoryService.updateMemory(memoryId, {
      content,
      importance,
      metadata
    });

    res.json({
      success: true,
      memory
    });
  } catch (error: any) {
    console.error('L [MEMORY API] Error updating memory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update memory',
      message: error.message
    });
  }
});

/**
 * DELETE /api/memories/:memoryId
 * Delete a memory
 */
router.delete('/:memoryId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { memoryId } = req.params;

    console.log(`=Ñ [MEMORY API] DELETE /api/memories/${memoryId} - User: ${userId.substring(0, 8)}...`);

    // Verify memory belongs to user
    const existingMemories = await memoryService.getUserMemories(userId);
    const memoryExists = existingMemories.some(m => m.id === memoryId);

    if (!memoryExists) {
      return res.status(404).json({
        success: false,
        error: 'Memory not found',
        message: 'Memory does not exist or does not belong to this user'
      });
    }

    await memoryService.deleteMemory(memoryId);

    res.json({
      success: true,
      message: 'Memory deleted successfully'
    });
  } catch (error: any) {
    console.error('L [MEMORY API] Error deleting memory:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete memory',
      message: error.message
    });
  }
});

/**
 * DELETE /api/memories
 * Delete all memories for a user (optionally filtered by section)
 * Query params:
 *   - section: Filter by memory section (optional)
 */
router.delete('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const section = req.query.section as MemorySection | undefined;

    console.log(`=Ñ [MEMORY API] DELETE /api/memories - User: ${userId.substring(0, 8)}...${section ? ` (${section})` : ''}`);

    const deletedCount = await memoryService.deleteUserMemories(userId, section);

    res.json({
      success: true,
      message: `Deleted ${deletedCount} memory(ies)`,
      count: deletedCount
    });
  } catch (error: any) {
    console.error('L [MEMORY API] Error deleting memories:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete memories',
      message: error.message
    });
  }
});

export default router;
