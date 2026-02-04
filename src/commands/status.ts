import { formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { loadKey, CONFIG_DIR } from '../lib/config.js';
import { loadPrivySession } from '../lib/auth.js';
import { getReppoBalance, getPublishingFee, getEthBalance } from '../lib/chain.js';
import { CHAIN_ID, POD_CONTRACT, REPPO_TOKEN, PRIVY_APP_ID } from '../constants.js';
import { isJsonMode, outputResult } from '../lib/output.js';

export async function cmdStatus(): Promise<void> {
  const pk = loadKey('private_key');
  const moltbookKey = loadKey('moltbook_key');
  const session = loadPrivySession();

  if (isJsonMode()) {
    const result: Record<string, unknown> = {
      auth: {
        privateKey: !!pk,
        moltbookKey: !!moltbookKey,
        privySession: session && !session.expired ? 'active' : session?.expired ? 'expired' : 'none',
        privyUserId: session?.userId || null,
      },
      config: {
        chainId: CHAIN_ID,
        podContract: POD_CONTRACT,
        reppoToken: REPPO_TOKEN,
        configDir: CONFIG_DIR,
      },
    };

    if (pk) {
      try {
        const account = privateKeyToAccount(pk.startsWith('0x') ? (pk as `0x${string}`) : `0x${pk}`);
        const [reppoBalance, ethBalance, fee] = await Promise.all([
          getReppoBalance(account.address),
          getEthBalance(account.address),
          getPublishingFee(),
        ]);
        result.wallet = {
          address: account.address,
          reppoBalance: reppoBalance.toString(),
          reppoBalanceFormatted: formatUnits(reppoBalance, 18),
          ethBalance: ethBalance.toString(),
          ethBalanceFormatted: formatUnits(ethBalance, 18),
          publishingFee: fee.toString(),
          publishingFeeFormatted: formatUnits(fee, 18),
          canPublish: fee === 0n || reppoBalance >= fee,
        };
      } catch (e) {
        result.wallet = { error: e instanceof Error ? e.message : String(e) };
      }
    }

    outputResult(result);
    return;
  }

  // Human-readable output
  console.log('Auth Status:');
  console.log(`  Private key:      ${pk ? 'configured' : 'missing'}`);
  console.log(`  Moltbook API key: ${moltbookKey ? 'configured' : 'missing'}`);

  if (session && !session.expired) {
    console.log(`  Privy session:    active (user: ${session.userId || 'unknown'})`);
  } else if (session?.expired) {
    console.log(`  Privy session:    expired (will auto-refresh on next request)`);
  } else {
    console.log(`  Privy session:    not logged in (run: reppo login)`);
  }

  if (pk) {
    try {
      const account = privateKeyToAccount(pk.startsWith('0x') ? (pk as `0x${string}`) : `0x${pk}`);
      console.log(`\nWallet: ${account.address}`);

      const [reppoBalance, ethBalance, fee] = await Promise.all([
        getReppoBalance(account.address),
        getEthBalance(account.address),
        getPublishingFee(),
      ]);

      console.log(`  ETH balance:    ${formatUnits(ethBalance, 18)} ETH`);
      console.log(`  REPPO balance:  ${formatUnits(reppoBalance, 18)}`);
      console.log(`  Publishing fee: ${formatUnits(fee, 18)} REPPO`);
      if (fee > 0n && reppoBalance < fee) {
        console.log(`  WARNING: Insufficient REPPO for publishing!`);
      } else {
        console.log(`  Ready to publish`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  Could not fetch on-chain data: ${msg}`);
    }
  }

  console.log(`\nConfig:`);
  console.log(`  Chain:        Base (${CHAIN_ID})`);
  console.log(`  Pod contract: ${POD_CONTRACT}`);
  console.log(`  REPPO token:  ${REPPO_TOKEN}`);
  console.log(`  Config dir:   ${CONFIG_DIR}`);
}
