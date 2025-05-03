import { Minimatch } from 'minimatch';

const MATCH_NOTHING = /(?!)/; // Return a never-matching regex if pattern is invalid
const MINIMATCH_OPTIONS = {
  dot: true, // Match dotfiles
  nocase: false, // Case sensitive
  noglobstar: false, // Support ** for matching across directories
  matchBase: false,
};

/**
 * Converts a glob pattern to a regular expression
 * @param glob The glob pattern to convert
 * @returns A RegExp object that matches the glob pattern
 */
export function globToRegex(origGlob: string): RegExp {
  let glob = origGlob;
  if (glob === '') {
    glob = '*';
  }

  // if glob doesn't start with `/`, prefix it with `**/`
  if (!glob.startsWith('/')) {
    glob = `**/${glob}`;
  }

  const mm = new Minimatch(glob, MINIMATCH_OPTIONS);
  return mm.makeRe() || MATCH_NOTHING;
}

export function stripPrefix(prefix: string, path?: string): string | undefined {
  if (!path) {
    return undefined;
  }

  // If prefix is empty, just normalize the path and ensure it starts with /
  if (!prefix) {
    return '/' + path.replace(/^\.\//, '').replace(/^\//, '');
  }

  // Normalize both paths by removing leading ./ and /, and trailing /
  const normalizedPath = path.replace(/^\.\//, '').replace(/^\//, '');
  const normalizedPrefix = prefix.replace(/^\.\//, '').replace(/^\//, '').replace(/\/$/, '');

  // If the path starts with the prefix, remove it and ensure it starts with /
  if (normalizedPath.startsWith(normalizedPrefix + '/')) {
    return '/' + normalizedPath.slice(normalizedPrefix.length + 1);
  }

  // If the path equals the prefix, return /
  if (normalizedPath === normalizedPrefix) {
    return '/';
  }

  // If the path doesn't start with the prefix, return undefined
  return undefined;
}

export function filterPathsWithGlobAndPrefix(paths: (string | undefined)[], prefix: string, glob: string): string[] {
  const globRegex = globToRegex(glob);
  const results: string[] = [];
  for (const path of paths) {
    if (!path) continue;
    const strippedPath = stripPrefix(prefix, path);
    if (!strippedPath) continue;
    if (globRegex.test(strippedPath)) {
      results.push(path);
    }
  }
  return results;
}
