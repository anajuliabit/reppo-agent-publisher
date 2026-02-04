import { privyLogin } from '../lib/auth.js';
import { CONFIG_DIR } from '../lib/config.js';
import { isJsonMode, outputResult } from '../lib/output.js';
import { join } from 'path';

export async function cmdLogin(): Promise<void> {
  const session = await privyLogin();

  if (isJsonMode()) {
    outputResult({
      userId: session.userId || null,
      sessionFile: join(CONFIG_DIR, 'privy_session.json'),
    });
  } else {
    console.log(`\nPrivy session active`);
    console.log(`  User: ${session.userId || 'unknown'}`);
    console.log(`  Token saved to: ${join(CONFIG_DIR, 'privy_session.json')}`);
  }
}
