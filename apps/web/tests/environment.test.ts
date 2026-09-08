import { describe, expect, it } from 'vitest';

import { readWebEnvironment } from '../src/app/environment';

describe('web environment', () => {
  it('uses the deploy-safe same-origin API path by default', () => {
    expect(readWebEnvironment({})).toEqual({ apiBaseUrl: '/api' });
  });

  it('accepts absolute deploy URLs and removes a trailing slash', () => {
    expect(readWebEnvironment({ VITE_API_BASE_URL: 'https://api.example.test/' })).toEqual({
      apiBaseUrl: 'https://api.example.test',
    });
  });
});
