import { readFileSync } from 'fs';
import path, { join } from 'path';
import { minimatch } from 'minimatch';
import { GitProvider } from './gitProvider';

export interface CursorRule {
  description: string;
  globs: string[];
  alwaysApply: boolean;
  content: string;
}

export function matchesGlob(filePath: string, glob: string): boolean {
  return minimatch(filePath, glob, { matchBase: true });
}

export function matchesAnyGlob(filePath: string, globs: string[]): boolean {
  return globs.some((glob) => matchesGlob(filePath, glob));
}

export function parseCursorRule(fileName: string, content: string): CursorRule {
  const parts = content.trim().split('---').filter(Boolean);
  if (parts.length < 2) {
    throw new Error('Invalid cursor rule: missing front matter');
  }

  const [frontMatter, ...ruleContent] = parts;
  const properties: Record<string, string> =
    frontMatter?.split('\n').reduce(
      (acc, line) => {
        const [key, ...values] = line.split(':').map((s) => s.trim());
        if (key && values.length > 0 && key !== '') {
          acc[key] = values.join(':').trim();
        }
        return acc;
      },
      {} as Record<string, string>,
    ) ?? {};

  return {
    description: properties.description || fileName,
    globs: (properties.globs || '')
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean),
    alwaysApply: properties.alwaysApply === 'true',
    content: ruleContent.join('---').trim(),
  };
}

export function findMatchingRules(filePaths: string[], rules: CursorRule[]): CursorRule[] {
  // Create a Set to store unique rules
  const matchingRules = new Set<CursorRule>();

  // For each file path, find matching rules and add them to the Set
  for (const filePath of filePaths) {
    for (const rule of rules) {
      if (rule.alwaysApply || matchesAnyGlob(filePath, rule.globs)) {
        matchingRules.add(rule);
      }
    }
  }

  // Convert Set back to array
  return Array.from(matchingRules);
}

export async function loadCursorRulesFromDirectory(rulesDir: string, provider: GitProvider): Promise<CursorRule[]> {
  try {
    const rules: CursorRule[] = [];
    const files = await provider.listFiles(rulesDir, '*.mdc');

    for (const file of files) {
      try {
        const content = await provider.getFileContent(file);
        rules.push(parseCursorRule(path.basename(file, '.mdc'), content));
      } catch (error) {
        console.error(`Error parsing cursor rule file ${file}:`, error);
      }
    }

    return rules;
  } catch (error) {
    console.error('Error loading cursor rules directory:', error);
    return [];
  }
}
