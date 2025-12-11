/**
 * Koda Retrieval Engine V2
 *
 * Re-exports from V1 for backwards compatibility
 */

import { kodaRetrievalEngineV1 } from './kodaRetrievalEngineV1.service';

// Re-export with V2 name for backwards compatibility
export const kodaRetrievalEngineV2 = kodaRetrievalEngineV1;
export default kodaRetrievalEngineV2;
