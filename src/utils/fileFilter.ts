import { minimatch } from 'minimatch';

interface FileObject {
  filename: string;
  status: string;
  changes: number;
}

interface FilterOptions {
  includePatterns?: string[];
  excludePatterns?: string[];
  maxFiles?: number;
}

/**
 * Determines if a file should be analyzed based on its properties and patterns
 * @param {string} filename - The name/path of the file
 * @param {string[]} includePatterns - Glob patterns for files to include
 * @param {string[]} excludePatterns - Glob patterns for files to exclude
 * @returns {boolean}
 */
function matchesPatterns(filename: string, includePatterns: string[], excludePatterns: string[]): boolean {
  // If no include patterns are specified, consider all files as included
  const isIncluded = includePatterns.length === 0 || includePatterns.some((pattern) => minimatch(filename, pattern));
  console.debug(`File ${filename} is included: ${isIncluded}`);

  // Check if file matches any exclude pattern
  const isExcluded = excludePatterns.some((pattern) => minimatch(filename, pattern));
  console.debug(`File ${filename} is excluded: ${isExcluded}`);

  return isIncluded && !isExcluded;
}

/**
 * Analyzes a file's changes to determine if it needs review
 * @param {Object} file - The file object from GitHub API
 * @returns {boolean}
 */
function hasSignificantChanges(file: FileObject): boolean {
  // Skip files that are deleted
  if (file.status === 'removed') {
    return false;
  }

  // Skip files that are too large
  const MAX_CHANGES = 1000;
  if (file.changes > MAX_CHANGES) {
    console.error(`File ${file.filename} has too many changes (${file.changes}). Skipping.`);
    return false;
  }

  // Skip files that are just moves without changes
  if (file.status === 'renamed' && file.changes === 0) {
    return false;
  }

  return true;
}

/**
 * Filter files for analysis based on patterns and other criteria
 * @param {Object[]} files - Array of file objects from GitHub API
 * @param {Object} options - Filtering options
 * @returns {Object[]} Filtered array of files
 */
export function filterFiles(files: FileObject[], options: FilterOptions): FileObject[] {
  const { includePatterns = [], excludePatterns = [], maxFiles = 10 } = options;

  console.debug(`Filtering ${files.length} files`);
  console.debug(`Include patterns: ${includePatterns.join(', ')}`);
  console.debug(`Exclude patterns: ${excludePatterns.join(', ')}`);

  const filteredFiles = files
    .filter((file) => {
      console.debug(`Analyzing file: ${file.filename}`);
      // console.debug(JSON.stringify(file, null, 2));
      const shouldAnalyze =
        matchesPatterns(file.filename, includePatterns, excludePatterns) && hasSignificantChanges(file);

      if (!shouldAnalyze) {
        console.debug(`Skipping ${file.filename}`);
      }

      return shouldAnalyze;
    })
    .sort((a, b) => {
      // Prioritize files with more changes
      return b.changes - a.changes;
    })
    .slice(0, maxFiles);

  console.log(`Selected ${filteredFiles.length} files for analysis`);
  filteredFiles.forEach((file) => {
    console.debug(`Will analyze: ${file.filename} (${file.changes} changes)`);
  });
  return filteredFiles;
}

export { matchesPatterns, hasSignificantChanges };
