import { describe, it, expect, vi } from 'vitest';
import {
  promptAccountDetails,
  promptAccountSelection,
  promptCloneConfirmation,
} from '../../src/prompts/index.js';

describe('Interactive Prompts', () => {
  describe('promptAccountDetails', () => {
    it('prompts for username and masked PAT', async () => {
      const mockInput = vi
        .fn()
        .mockResolvedValueOnce('test-user')
        .mockResolvedValueOnce('Test User')
        .mockResolvedValueOnce('test@example.com');
      const mockPassword = vi.fn().mockResolvedValue('ghp_test_token_123');

      const result = await promptAccountDetails(
        {
          input: mockInput,
          password: mockPassword,
        },
        { existingUsername: 'old-user' },
      );

      expect(mockInput).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'GitHub username:',
          default: 'old-user',
        }),
      );
      expect(mockPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'GitHub Personal Access Token (PAT):',
          mask: '*',
        }),
      );
      expect(result).toEqual({
        username: 'test-user',
        pat: 'ghp_test_token_123',
        name: 'Test User',
        email: 'test@example.com',
      });
    });

    it('rejects empty username or PAT', async () => {
      const mockInput = vi.fn().mockResolvedValue('valid-user');
      const mockPassword = vi.fn().mockResolvedValue('ghp_token');

      await promptAccountDetails({
        input: mockInput,
        password: mockPassword,
      });

      const inputValidate = mockInput.mock.calls[0][0].validate;
      expect(inputValidate('')).toBe('Username cannot be empty.');
      expect(inputValidate('   ')).toBe('Username cannot be empty.');
      expect(inputValidate('valid-user')).toBe(true);

      const passwordValidate = mockPassword.mock.calls[0][0].validate;
      expect(passwordValidate('')).toBe(
        'Personal Access Token cannot be empty.',
      );
      expect(passwordValidate('ghp_token')).toBe(true);
    });
  });

  describe('promptAccountSelection', () => {
    it('presents vertical choices with alias and username and preselects mapped account', async () => {
      const mockSelect = vi.fn().mockResolvedValue('work');

      const accounts = {
        personal: {
          username: 'my-personal-user',
          credentialRef: 'ghx-personal',
        },
        work: { username: 'company-user', credentialRef: 'ghx-work' },
      };

      const selected = await promptAccountSelection(accounts, 'work', {
        select: mockSelect,
      });

      expect(selected).toBe('work');
      expect(mockSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Select a GitHub account:',
          default: 'work',
          choices: [
            { name: 'personal (my-personal-user)', value: 'personal' },
            { name: 'work     (company-user)', value: 'work' },
          ],
        }),
      );
    });

    it('throws descriptive error if accounts object is empty', async () => {
      await expect(promptAccountSelection({}, undefined)).rejects.toThrow(
        /No accounts configured/i,
      );
    });
  });

  describe('promptCloneConfirmation', () => {
    it('presents confirmation with preview and defaults strictly to No (false)', async () => {
      const mockSelect = vi.fn().mockResolvedValue(false);

      const preview = {
        alias: 'work',
        repository: 'company-org/my-project',
        destination: './my-project',
        maskedUrl:
          'https://company-user:********@github.com/company-org/my-project.git',
      };

      const confirmed = await promptCloneConfirmation(preview, {
        select: mockSelect,
      });

      expect(confirmed).toBe(false);
      expect(mockSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Do you want me to run this command now?',
          default: false,
          choices: [
            { name: 'Yes', value: true },
            { name: 'No', value: false },
          ],
        }),
      );
    });

    it('returns true when user explicitly selects Yes', async () => {
      const mockSelect = vi.fn().mockResolvedValue(true);

      const preview = {
        alias: 'personal',
        repository: 'user/repo',
        destination: './repo',
        maskedUrl: 'https://user:********@github.com/user/repo.git',
      };

      const confirmed = await promptCloneConfirmation(preview, {
        select: mockSelect,
      });
      expect(confirmed).toBe(true);
    });

    it('returns false if prompt is cancelled or rejected with ExitPromptError', async () => {
      const mockSelect = vi
        .fn()
        .mockRejectedValue(new Error('User force closed the prompt'));

      const preview = {
        alias: 'personal',
        repository: 'user/repo',
        destination: './repo',
        maskedUrl: 'https://user:********@github.com/user/repo.git',
      };

      const confirmed = await promptCloneConfirmation(preview, {
        select: mockSelect,
      });
      expect(confirmed).toBe(false);
    });
  });
});
