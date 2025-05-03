import { LocalGitDiffProvider } from './localgit';
import { Config } from '../types';
import path from 'path';
import assert from 'assert';

describe('LocalGitDiffProvider', () => {
  const repoPath = path.resolve(__dirname, '../../test/fixtures/test-git-repo');
  const config: Config = {
    anthropicApiKey: 'test-key',
    model: 'test-model',
    analysisLevel: 'basic',
    include: ['*.txt', '*.md'],
    exclude: [],
    maxFiles: 100,
    maxSize: 1000,
    commentThreshold: 0.5,
    writePullRequest: false,
    output: 'stdout',
    workingDir: repoPath,
    mode: 'localgit',
    localgit: {
      baseSha: 'main', // Initial commit
      headSha: 'HEAD', // Feature branch
    },
  };

  let provider: LocalGitDiffProvider;

  beforeAll(async () => {
    provider = await LocalGitDiffProvider.getInstance(config);
  });

  describe('listFiles', () => {
    it('should list all files matching glob pattern', async () => {
      const files = await provider.listFiles('', '*.txt');
      expect(files).toContain('feature.txt');
    });

    it('should list files in specific directory', async () => {
      const files = await provider.listFiles('', '*.md');
      expect(files).toContain('README.md');
    });

    it('should return empty array for non-matching pattern', async () => {
      const files = await provider.listFiles('', '*.nonexistent');
      expect(files).toHaveLength(0);
    });

    it('should find files using recursive glob patterns', async () => {
      const files = await provider.listFiles('', '**/*.mdc');
      console.log('Files found:', files);
      expect(files).toContain('.cursor/rules/codes-files.mdc');
      expect(files).toContain('.cursor/rules/text-files.mdc');
    });
  });

  describe('getDiff', () => {
    it('should get diff between commits', async () => {
      const diff = await provider.getDiff();
      expect(diff.baseSha).toBe('main');
      expect(diff.headSha).toBe('HEAD');
      expect(diff.files).toHaveLength(4);
      const featureChange = diff.files.find((file) => file.filename === 'feature.txt');
      assert(featureChange, 'should be a feature change');
      expect(featureChange.status).toBe('modified');
      expect(featureChange.patch).toContain('Feature branch');
    });
  });

  describe('getFileContent', () => {
    it('should get content of existing file', async () => {
      const content = await provider.getFileContent('feature.txt');
      expect(content).toContain('Feature branch');
    });

    it('should return empty string for non-existent file', async () => {
      const content = await provider.getFileContent('nonexistent.txt');
      expect(content).toBe('');
    });
  });

  describe('writeComment', () => {
    it('should write comment to stdout', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      await provider.writeComment('Test comment');
      expect(consoleSpy).toHaveBeenCalledWith('=== Analysis Results ===');
      expect(consoleSpy).toHaveBeenCalledWith('Test comment');
      expect(consoleSpy).toHaveBeenCalledWith('=======================');
      consoleSpy.mockRestore();
    });
  });
});
