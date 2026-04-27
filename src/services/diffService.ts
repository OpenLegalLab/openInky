import * as jsdiff from 'diff';

export interface DiffChunk {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export function computeWordDiff(original: string, modified: string): DiffChunk[] {
  return jsdiff.diffWords(original, modified);
}
