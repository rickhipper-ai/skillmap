import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('production API proxy', () => {
  it('expands the upstream at startup and strips only the /api prefix', async () => {
    const template = await readFile(resolve(process.cwd(), 'nginx.conf.template'), 'utf8');

    expect(template).toContain('location /api/');
    expect(template).toContain('proxy_pass ${API_UPSTREAM}/;');
    expect(template).not.toContain('proxy_pass $api_upstream');
    expect(template).toContain('proxy_set_header Host $proxy_host;');
    expect(template).toContain('proxy_set_header X-Forwarded-Host $host;');
    expect(template).toContain('proxy_ssl_server_name on;');
  });
});
