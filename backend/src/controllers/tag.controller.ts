import { Request, Response } from 'express';
import * as tagService from '../services/tag.service';

/**
 * Create tag
 */
export const createTag = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, color } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Tag name is required' });
      return;
    }

    const tag = await tagService.createTag(req.users.id, name, color);

    res.status(201).json({ tag });
  } catch (error) {
    const err = error as Error;
    res.status(400).json({ error: err.message });
  }
};

/**
 * Get user tags
 */
export const getUserTags = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const tags = await tagService.getUserTags(req.users.id);

    res.status(200).json({ tags });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
};

/**
 * Add tag to document
 */
export const addTagToDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { documentId, tagId } = req.body;

    if (!documentId || !tagId) {
      res.status(400).json({ error: 'Document ID and Tag ID are required' });
      return;
    }

    const result = await tagService.addTagToDocument(documentId, tagId, req.users.id);

    res.status(200).json(result);
  } catch (error) {
    const err = error as Error;
    res.status(400).json({ error: err.message });
  }
};

/**
 * Remove tag from document
 */
export const removeTagFromDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { documentId, tagId } = req.body;

    if (!documentId || !tagId) {
      res.status(400).json({ error: 'Document ID and Tag ID are required' });
      return;
    }

    await tagService.removeTagFromDocument(documentId, tagId, req.users.id);

    res.status(200).json({ message: 'Tag removed successfully' });
  } catch (error) {
    const err = error as Error;
    res.status(400).json({ error: err.message });
  }
};

/**
 * Delete tag
 */
export const deleteTag = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    await tagService.deleteTag(id, req.users.id);

    res.status(200).json({ message: 'Tag deleted successfully' });
  } catch (error) {
    const err = error as Error;
    res.status(400).json({ error: err.message });
  }
};

/**
 * Search documents by tag
 */
export const searchByTag = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const documents = await tagService.searchDocumentsByTag(id, req.users.id);

    res.status(200).json({ documents });
  } catch (error) {
    const err = error as Error;
    res.status(400).json({ error: err.message });
  }
};
