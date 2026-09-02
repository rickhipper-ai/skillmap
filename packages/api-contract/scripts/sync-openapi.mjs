import { copyFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';

const canonicalContract = fileURLToPath(
  new URL('../../../specs/001-mvp-skill-maps/contracts/openapi.yaml', import.meta.url),
);
const packageContract = fileURLToPath(new URL('../openapi.yaml', import.meta.url));

await copyFile(canonicalContract, packageContract);
