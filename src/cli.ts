import { config } from 'dotenv';
import { Command } from 'commander';
import { setJsonMode } from './lib/output.js';
import { DEFAULT_SUBMOLT } from './constants.js';

// Load .env file if present
config();

const program = new Command();

program
  .name('reppo')
  .version('0.1.0')
  .description('Publish AI agent training intentions to Reppo.ai')
  .option('--json', 'Output results as JSON (for programmatic use)')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();
    if (opts.json) setJsonMode(true);
  });

program
  .command('login')
  .description('Authenticate with Reppo via Privy (SIWE wallet login)')
  .action(async () => {
    const { cmdLogin } = await import('./commands/login.js');
    await cmdLogin();
  });

program
  .command('init')
  .description('Interactive setup wizard for credentials and config')
  .action(async () => {
    const { cmdInit } = await import('./commands/init.js');
    await cmdInit();
  });

program
  .command('post')
  .description('Post content to Moltbook')
  .requiredOption('--title <title>', 'Content title (3-50 chars)')
  .requiredOption('--body <body>', 'Content body (markdown)')
  .option('--submolt <name>', 'Target submolt', DEFAULT_SUBMOLT)
  .option('--dry-run', 'Simulate without making changes')
  .action(async (opts) => {
    const { cmdPost } = await import('./commands/post.js');
    await cmdPost(opts);
  });

program
  .command('mint')
  .description('Mint pod on-chain and submit metadata to Reppo')
  .requiredOption('--title <title>', 'Content title (3-50 chars)')
  .requiredOption('--url <url>', 'Content URL (e.g. Moltbook post URL)')
  .option('--description <desc>', 'Short description (10-200 chars)')
  .option('--image-url <url>', 'Image URL for the pod')
  .option('--skip-approve', 'Skip ERC20 approval step')
  .option('--dry-run', 'Simulate without sending transactions')
  .action(async (opts) => {
    const { cmdMint } = await import('./commands/mint.js');
    await cmdMint({
      title: opts.title,
      url: opts.url,
      description: opts.description,
      imageURL: opts.imageUrl,
      skipApprove: opts.skipApprove,
      dryRun: opts.dryRun,
    });
  });

program
  .command('publish')
  .description('Full flow: post to Moltbook + mint pod + submit metadata')
  .requiredOption('--title <title>', 'Content title (3-50 chars)')
  .requiredOption('--body <body>', 'Content body (markdown)')
  .option('--description <desc>', 'Short description (10-200 chars)')
  .option('--submolt <name>', 'Target submolt', DEFAULT_SUBMOLT)
  .option('--image-url <url>', 'Image URL for the pod')
  .option('--skip-approve', 'Skip ERC20 approval step')
  .option('--dry-run', 'Simulate without making changes')
  .action(async (opts) => {
    const { cmdPublish } = await import('./commands/publish.js');
    await cmdPublish({
      title: opts.title,
      body: opts.body,
      description: opts.description,
      submolt: opts.submolt,
      imageURL: opts.imageUrl,
      skipApprove: opts.skipApprove,
      dryRun: opts.dryRun,
    });
  });

program
  .command('buy')
  .description('Buy REPPO tokens with USDC via Uniswap')
  .requiredOption('--amount <amount>', 'Amount of REPPO to buy')
  .option('--slippage <percent>', 'Slippage tolerance in percent', '1')
  .option('--dry-run', 'Simulate without executing')
  .action(async (opts) => {
    const { cmdBuy } = await import('./commands/buy.js');
    await cmdBuy(opts);
  });

program
  .command('balance')
  .description('Show wallet balances (ETH, REPPO, USDC)')
  .action(async () => {
    const { cmdBalance } = await import('./commands/balance.js');
    await cmdBalance();
  });

program
  .command('fee')
  .description('Check current publishing fee')
  .action(async () => {
    const { cmdFee } = await import('./commands/fee.js');
    await cmdFee();
  });

program
  .command('status')
  .description('Show auth, wallet balance, and config')
  .action(async () => {
    const { cmdStatus } = await import('./commands/status.js');
    await cmdStatus();
  });

export async function run(): Promise<void> {
  try {
    await program.parseAsync(process.argv);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${msg}`);
    if (process.env['DEBUG']) {
      console.error(err);
    }
    process.exit(1);
  }
}
