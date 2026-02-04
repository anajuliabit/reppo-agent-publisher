import * as readline from 'readline';
import { loadKey, saveKey, CONFIG_DIR } from '../lib/config.js';
import { privyLogin } from '../lib/auth.js';
import { getReppoBalance, getPublishingFee, getEthBalance } from '../lib/chain.js';
import { formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function cmdInit(): Promise<void> {
  console.log('Reppo Agent Publisher - Setup\n');
  console.log(`Config directory: ${CONFIG_DIR}\n`);

  // Private key
  const existingPk = loadKey('private_key');
  if (existingPk) {
    const account = privateKeyToAccount(existingPk.startsWith('0x') ? (existingPk as `0x${string}`) : `0x${existingPk}`);
    console.log(`Private key: already configured (${account.address})`);
    const overwrite = await prompt('Overwrite? (y/N): ');
    if (overwrite.toLowerCase() === 'y') {
      const pk = await prompt('Enter your Ethereum private key (Base network): ');
      if (pk) {
        saveKey('private_key', pk);
        console.log('  Saved (permissions: 600)\n');
      }
    } else {
      console.log('  Keeping existing key\n');
    }
  } else {
    const pk = await prompt('Enter your Ethereum private key (Base network): ');
    if (pk) {
      saveKey('private_key', pk);
      console.log('  Saved (permissions: 600)\n');
    } else {
      console.log('  Skipped\n');
    }
  }

  // Moltbook key
  const existingMk = loadKey('moltbook_key');
  if (existingMk) {
    console.log(`Moltbook API key: already configured`);
    const overwrite = await prompt('Overwrite? (y/N): ');
    if (overwrite.toLowerCase() === 'y') {
      const mk = await prompt('Enter your Moltbook API key: ');
      if (mk) {
        saveKey('moltbook_key', mk);
        console.log('  Saved (permissions: 600)\n');
      }
    } else {
      console.log('  Keeping existing key\n');
    }
  } else {
    const mk = await prompt('Enter your Moltbook API key: ');
    if (mk) {
      saveKey('moltbook_key', mk);
      console.log('  Saved (permissions: 600)\n');
    } else {
      console.log('  Skipped\n');
    }
  }

  // Authenticate with Privy
  const pk = loadKey('private_key');
  if (pk) {
    console.log('Authenticating with Reppo...');
    try {
      await privyLogin();
    } catch (e) {
      console.error(`  Auth failed: ${e instanceof Error ? e.message : String(e)}\n`);
    }

    // Wallet info
    try {
      const account = privateKeyToAccount(pk.startsWith('0x') ? (pk as `0x${string}`) : `0x${pk}`);
      console.log(`\nWallet: ${account.address}`);

      const [ethBalance, reppoBalance, fee] = await Promise.all([
        getEthBalance(account.address),
        getReppoBalance(account.address),
        getPublishingFee(),
      ]);

      console.log(`  ETH balance:    ${formatUnits(ethBalance, 18)} ETH`);
      console.log(`  REPPO balance:  ${formatUnits(reppoBalance, 18)} REPPO`);
      console.log(`  Publishing fee: ${formatUnits(fee, 18)} REPPO`);

      if (fee > 0n && reppoBalance < fee) {
        console.log(`\n  WARNING: Insufficient REPPO for publishing`);
      } else {
        console.log(`\n  Ready to publish!`);
      }
    } catch (e) {
      console.error(`  Could not fetch wallet info: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else {
    console.log('Skipping auth and wallet check (no private key configured)');
  }

  console.log('\nSetup complete. Run "reppo status" to verify configuration.');
}
