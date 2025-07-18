import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { AnthropicBatchManager } from './anthropic';
import { Config, FileData, AnalysisOptions, CommitMessage } from './types';
import { loadCursorRulesFromDirectory, findMatchingRules } from './cursorRules';
import { DiffSet, DiffSetEntry, GitProvider } from './gitProvider';
import { GitHubDiffProvider } from './gitProviders/github';
import { LocalGitDiffProvider } from './gitProviders/localgit';
import { logger } from './utils/logger';
import { globToRegex, stripPrefix } from './utils/glob';
import { makeConciseFile, parsePatch } from './utils/diff';

function indent(text: string, indent: number): string {
  const indentString = ' '.repeat(indent);
  return text
    .split('\n')
    .map((line) => indentString + line)
    .join('\n');
}

async function generateCursorRules(files: FileData[], provider: GitProvider): Promise<string> {
  logger.debug('Loading cursor rules from directory');
  const rules = await loadCursorRulesFromDirectory(join('.cursor', 'rules'), provider);

  // Get all filenames
  const filenames = files.map((file) => file.filename);
  logger.debug('Files to check for rules:', filenames);

  // Find matching rules for all files
  const matchingRules = findMatchingRules(filenames, rules);
  logger.debug('Found matching rules:', matchingRules.length);

  if (matchingRules.length === 0) {
    return '';
  }

  // Concatenate unique rule contents
  const formattedRules = matchingRules
    .map(
      (rule) =>
        `## Rule set: ${rule.description}\n\nOnly applies to files matching these globs: ${rule.globs.join(', ')}\n\n${indent(rule.content, 4)}`,
    )
    .join('\n\n');

  return `Additional rules for this codebase:\n\n${formattedRules}\n\n`;
}

const PROMPT_TEMPLATE = `
# Task

Analyze the following code changes from a pull request and provide a detailed review.

Focus on:

1. Code quality (potential bugs? obviously wrong logic?)
2. Adherence to the rules

For each file, provide:

- Suggestions for improvements
- Any violations of the coding rules (below)
- DO NOT say what the code does, or what it does well. Only apply rules with globs that match the file changed.
- If no violations, skip the file; be brief.

# Coding rules:

It is VERY IMPORTANT that the code follows these rules.

{cursor_rules}

---

# Commit Messages:

{commit_messages}

---

# Changes:

{changes}

`;

async function analyzeFiles(params: {
  files: FileData[];
  options: AnalysisOptions;
  config: Config;
  commitMessages: CommitMessage[];
  cursorRules: string;
}): Promise<string> {
  const { files, options, config, commitMessages, cursorRules } = params;

  const anthropic = new AnthropicBatchManager(process.env.ANTHROPIC_API_KEY || '');

  // Format commit messages
  const formattedCommitMessages =
    commitMessages.length > 0
      ? commitMessages.map((commit) => commit.message).join('\n\n')
      : 'No commit messages found in this range.';

  logger.debug(
    'All files:',
    files.map((f) => [f.filename, f.status]),
  );
  logger.debug('Found commit messages:', commitMessages.length);

  const prompt = PROMPT_TEMPLATE.replace('{cursor_rules}', cursorRules)
    .replace('{commit_messages}', formattedCommitMessages)
    .replace(
      '{changes}',
      files
        .filter((f) => f.status !== 'removed')
        .map(
          (f) => `File: \`${f.filename}\`

${indent(f.change, 4)}
`,
        )
        .join('\n\n'),
    );

  if (config.dryRun) {
    console.log('=== DRY RUN: Prompt that would be sent to the model ===\n');
    console.log(prompt);
    console.log('\n=== End of prompt ===');
    return 'Dry run completed - no analysis performed';
  }

  const result = await anthropic.sendBatch([{ role: 'user', content: prompt }], options);

  return result[0]?.content || 'No analysis performed';
}

async function processFiles(provider: GitProvider, files: DiffSetEntry[], config: Config): Promise<FileData[]> {
  const fileData: FileData[] = [];
  const level: { maxFiles: number; maxSize: number } = {
    maxFiles: config.maxFiles,
    maxSize: config.maxSize,
  };
  logger.debug('Processing files with level:', level);

  const includePatterns = config.include.map((pattern) => globToRegex(pattern));
  const excludePatterns = config.exclude.map((pattern) => globToRegex(pattern));
  for (const file of files) {
    if (fileData.length >= level.maxFiles) {
      logger.debug('Reached maximum file limit:', level.maxFiles);
      break;
    }

    // Skip if file is too large
    if (file.patch.length > level.maxSize * 1024) {
      logger.debug('Skipping file due to size:', file.filename, file.patch.length, 'bytes');
      continue;
    }

    // Skip if file matches exclude patterns
    const absPath = stripPrefix('', file.filename);
    if (!absPath) continue;
    if (excludePatterns.some((pattern) => pattern.test(absPath))) {
      logger.debug('Skipping excluded file:', absPath, config.exclude);
      continue;
    }

    // Include only specified file patterns if provided
    if (config.include.length > 0 && !includePatterns.some((pattern) => pattern.test(absPath))) {
      logger.debug('Skipping file not matching patterns:', absPath, config.include);
      continue;
    }

    try {
      logger.debug('Processing file:', file.filename);
      const content = await provider.getFileContent(file.filename);

      const parsedPatch = parsePatch(file.patch);

      fileData.push({
        filename: file.filename,
        originalContent: content,
        change: makeConciseFile({
          parsedPatch,
          fileContent: content,
          beforeLines: config.beforeLines,
          afterLines: config.afterLines,
        }),
        changes: file.patch,
        status: file.status,
      });
    } catch (error) {
      console.error(error);
      logger.error('Error processing file:', file.filename, error);
    }
  }

  logger.info('Processed files:', fileData.length);
  return fileData;
}

export async function analyzePR(config: Config): Promise<void> {
  logger.info('Starting PR analysis with config:', { ...config, anthropicApiKey: '[REDACTED]' });
  let provider: GitProvider;
  let diff: DiffSet;

  if (config.mode === 'github') {
    logger.debug('Using GitHub provider');
    provider = await GitHubDiffProvider.getInstance(config);
    diff = await provider.getDiff();
  } else {
    logger.debug('Using local Git provider');
    provider = await LocalGitDiffProvider.getInstance(config);
    diff = await provider.getDiff();
  }

  logger.debug('Got diff with files:', diff.files.length);

  // Filter and process files
  const fileData = await processFiles(provider, diff.files, config);

  // get commit messages here
  const commitMessages = await provider.getCommitMessages(diff.baseSha, diff.headSha);

  // Prepare analysis options
  const analysisOptions: AnalysisOptions = {
    model: config.model,
    commentThreshold: config.commentThreshold,
    maxTokens: 30000 /** output tokens */,
    temperature: 0.7,
    maxRetries: 3,
    retryDelay: 1000,
  };
  logger.debug('Analysis options:', analysisOptions);

  // Analyze files
  logger.info('Starting file analysis');

  const cursorRules = await generateCursorRules(fileData, provider);
  const analysis = await analyzeFiles({
    files: fileData,
    options: analysisOptions,
    config,
    commitMessages,
    cursorRules,
  });

  logger.debug('Analysis:', analysis);

  // Save results
  if (config.output === undefined || config.output === 'stdout' || config.output === '-') {
    logger.debug('Outputting to stdout');
    console.log(analysis);
  } else {
    const outputDir = join(process.cwd(), config.output);
    logger.debug('Saving analysis to:', outputDir);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
    writeFileSync(join(outputDir, `analysis-${new Date().toISOString()}.md`), analysis);
  }

  // Write to PR if configured
  if (config.writePullRequest) {
    logger.info('Writing analysis to PR');
    await provider.writeComment(analysis);
  }

  logger.info('Analysis complete');
}
