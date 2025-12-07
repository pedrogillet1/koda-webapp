/**
 * Format Type Classifier Service - STUB (service removed)
 */

export type ResponseFormatType =
  | 'LIST'
  | 'TABLE'
  | 'NARRATIVE'
  | 'COMPARISON'
  | 'SUMMARY'
  | 'DIRECT_ANSWER'
  | 'STRUCTURED'
  | 'default';

export const classifyFormat = async (): Promise<ResponseFormatType> => 'default';
export default { classifyFormat };
