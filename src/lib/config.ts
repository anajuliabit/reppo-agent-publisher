import { readFileSync, existsSync, writeFileSync, mkdirSync, chmodSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { CONFIG_DIR_NAME } from '../constants.js';
import type { KeyName } from '../types.js';

export const CONFIG_DIR = join(homedir(), CONFIG_DIR_NAME);

const ENV_MAP: Record<KeyName, string> = {
  api_key: 'REPPO_API_KEY',
  moltbook_key: 'MOLTBOOK_API_KEY',
  private_key: 'REPPO_PRIVATE_KEY',
};

export function ensureConfigDir(): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
}

export function loadKey(name: KeyName): string | null {
  const envVar = ENV_MAP[name];
  if (envVar && process.env[envVar]) {
    return process.env[envVar]!.trim();
  }
  const path = join(CONFIG_DIR, name);
  if (existsSync(path)) {
    return readFileSync(path, 'utf-8').trim();
  }
  return null;
}

export function saveKey(name: KeyName, value: string): void {
  ensureConfigDir();
  const path = join(CONFIG_DIR, name);
  writeFileSync(path, value.trim() + '\n', { mode: 0o600 });
}

export function writeSecureFile(path: string, content: string): void {
  ensureConfigDir();
  writeFileSync(path, content, { mode: 0o600 });
}

export function getConfigValue(key: string): string | null {
  // Check env var first (REPPO_<KEY>)
  const envKey = `REPPO_${key.toUpperCase()}`;
  if (process.env[envKey]) return process.env[envKey]!;

  const path = join(CONFIG_DIR, key);
  if (existsSync(path)) {
    return readFileSync(path, 'utf-8').trim();
  }
  return null;
}

export function getRpcUrl(): string {
  return process.env['REPPO_RPC_URL'] || getConfigValue('rpc_url') || '';
}
