import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

register('./scripts/resolve-core.mjs', pathToFileURL('./'));
