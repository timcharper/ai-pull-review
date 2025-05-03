import { DIFF_STATUS } from './types';

// Our minimal types that only include fields we actually use
export interface DiffSetEntry {
  filename: string;
  status: DIFF_STATUS;
  patch: string;
}

export interface DiffSet {
  files: DiffSetEntry[];
  baseSha: string;
  headSha: string;
}

export interface GitProvider {
  getDiff(): Promise<DiffSet>;
  writeComment(comment: string): Promise<void>;
  getFileContent(filename: string): Promise<string>;
  listFiles(path: string, glob: string): Promise<string[]>;
}
