import { describe, expect, it } from 'vitest';

import { applicationName } from '../src/App';

describe('web workspace', () => {
  it('exposes the application identity', () => {
    expect(applicationName).toBe('SKILL MAPS');
  });
});
