/**
 * Stub file - formatTypeClassifier service was consolidated
 * This stub prevents runtime errors for any remaining imports
 */

export enum ResponseFormatType {
  PARAGRAPH = 'paragraph',
  LIST = 'list',
  TABLE = 'table',
  CODE = 'code',
  MIXED = 'mixed'
}

export const classifyFormat = (query: string): ResponseFormatType => {
  console.warn('[FORMAT-TYPE-CLASSIFIER-STUB] Service consolidated, returning MIXED');
  return ResponseFormatType.MIXED;
};

export default {
  classifyFormat,
  ResponseFormatType
};
