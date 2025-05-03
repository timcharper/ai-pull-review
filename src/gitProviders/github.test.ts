import { GitHubDiffProvider } from './github';
import { Config } from '../types';
import type { Octokit } from '@octokit/rest';
import { describe, it, expect, jest } from '@jest/globals';

describe('GitHubDiffProvider', () => {
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
    workingDir: '/test',
    mode: 'github',
    github: {
      token: 'test-token',
      repo: 'owner/repo',
      prNumber: 123,
    },
  };

  let mocktokit: Octokit;
  let provider: GitHubDiffProvider;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    const OctokitConstructor = await import('@octokit/rest').then((m) => m.Octokit);
    mocktokit = new OctokitConstructor({ auth: 'TEST' });
    jest.spyOn(mocktokit.pulls, 'get').mockResolvedValue({
      data: {
        base: { sha: 'base-sha' } as any,
        head: { sha: 'head-sha' } as any,
      } as any,
      headers: {},
      status: 200,
      url: 'https://api.github.com/pulls/123',
    } as any);
    provider = await GitHubDiffProvider.getInstance(config, mocktokit);
  });

  describe('getDiff', () => {
    it('should get diff between commits', async () => {
      jest.spyOn(mocktokit.pulls, 'listFiles').mockResolvedValue({
        data: [
          {
            filename: 'test.txt',
            status: 'modified',
            patch: 'test patch',
          },
        ],
      } as any);
      const diff = await provider.getDiff();
      expect(diff.baseSha).toBe('base-sha');
      expect(diff.headSha).toBe('head-sha');
      expect(diff.files).toHaveLength(1);
      expect(diff.files[0].filename).toBe('test.txt');
      expect(diff.files[0].status).toBe('modified');
      expect(diff.files[0].patch).toBe('test patch');

      expect(mocktokit.pulls.listFiles).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 123,
      });
    });
  });

  describe('getFileContent', () => {
    it('should get content of existing file', async () => {
      jest.spyOn(mocktokit.repos, 'getContent').mockResolvedValue({
        data: { content: Buffer.from('test content').toString('base64') } as any,
      } as any);
      const content = await provider.getFileContent('test.txt');
      expect(content).toBe('test content');

      expect(mocktokit.repos.getContent).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        path: 'test.txt',
        ref: 'head-sha',
      });
    });

    it('should return empty string for non-existent file', async () => {
      jest.spyOn(mocktokit.repos, 'getContent').mockRejectedValue(new Error('Not found'));
      const content = await provider.getFileContent('nonexistent.txt');
      expect(content).toBe('');
    });

    it('should handle non-file content', async () => {
      jest.spyOn(mocktokit.repos, 'getContent').mockResolvedValue({
        data: { type: 'directory' } as any,
      } as any);
      const content = await provider.getFileContent('dir/');
      expect(content).toBe('');
    });
  });

  describe('writeComment', () => {
    it('should post comment to PR', async () => {
      jest.spyOn(mocktokit.issues, 'createComment').mockResolvedValue({} as any);
      await provider.writeComment('Test comment');
      expect(mocktokit.issues.createComment).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        issue_number: 123,
        body: 'Test comment',
      });
    });
  });

  describe('listFiles', () => {
    it('should list all files matching glob pattern', async () => {
      jest.spyOn(mocktokit.git, 'getTree').mockResolvedValue({
        data: {
          tree: [
            { path: 'src/test.txt', type: 'blob' },
            { path: 'src/test.md', type: 'blob' },
          ],
        } as any,
      } as any);
      const files = await provider.listFiles('', '**/*.txt');
      expect(files).toContain('src/test.txt');
    });

    it('should list files in specific directory', async () => {
      jest.spyOn(mocktokit.git, 'getTree').mockResolvedValue({
        data: {
          tree: [
            { path: 'src/test.txt', type: 'blob' },
            { path: 'README.md', type: 'blob' },
          ],
        } as any,
      } as any);
      const files = await provider.listFiles('src/', '*.txt');
      expect(files).toContain('src/test.txt');
    });

    it('should find files using recursive glob patterns', async () => {
      jest.spyOn(mocktokit.git, 'getTree').mockResolvedValue({
        data: {
          tree: [
            { path: '.cursor/rules/codes-files.mdc', type: 'blob' },
            { path: '.cursor/rules/text-files.mdc', type: 'blob' },
          ],
        } as any,
      } as any);
      const files = await provider.listFiles('', '**/*.mdc');
      expect(files).toContain('.cursor/rules/codes-files.mdc');
      expect(files).toContain('.cursor/rules/text-files.mdc');
    });

    it('should return empty array for non-matching pattern', async () => {
      jest.spyOn(mocktokit.git, 'getTree').mockResolvedValue({
        data: { tree: [] } as any,
      } as any);
      const files = await provider.listFiles('', '*.nonexistent');
      expect(files).toHaveLength(0);
    });

    it('should handle API errors gracefully', async () => {
      jest.spyOn(mocktokit.git, 'getTree').mockRejectedValue(new Error('API error'));
      const files = await provider.listFiles('', '*.txt');
      expect(files).toHaveLength(0);
    });
  });
});
