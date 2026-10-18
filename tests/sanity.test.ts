import { describe, it, expect } from 'vitest';
import { VERSION } from '../src/index.js';

describe('Sanity check', () => {
  it('exports valid version string', () => {
    expect(VERSION).toBe('0.1.0');
  });
});
