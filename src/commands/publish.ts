import { postToMoltbook } from '../lib/moltbook.js';
import { mintPod, submitMetadata } from '../lib/chain.js';
import { validateTitle, validateBody, validateDescription } from '../lib/validate.js';
import { isJsonMode, outputResult } from '../lib/output.js';
import { DEFAULT_SUBMOLT } from '../constants.js';

export async function cmdPublish(opts: {
  title: string;
  body: string;
  description?: string;
  submolt?: string;
  imageURL?: string;
  skipApprove?: boolean;
  dryRun?: boolean;
}): Promise<void> {
  validateTitle(opts.title);
  validateBody(opts.body);
  if (opts.description) validateDescription(opts.description);

  if (opts.dryRun) {
    if (isJsonMode()) {
      outputResult({
        dryRun: true,
        steps: [
          { action: 'post', submolt: opts.submolt || DEFAULT_SUBMOLT },
          { action: 'approve', skip: opts.skipApprove || false },
          { action: 'mint' },
          { action: 'submitMetadata' },
        ],
      });
    } else {
      console.log(`[dry-run] Full publish simulation:`);
      console.log(`  1. Would post to Moltbook (m/${opts.submolt || DEFAULT_SUBMOLT})`);
      console.log(`  2. Would approve REPPO spend${opts.skipApprove ? ' (skipped)' : ''}`);
      console.log(`  3. Would mint pod on Base`);
      console.log(`  4. Would submit metadata to Reppo`);
    }
    return;
  }

  // Step 1: Post to Moltbook
  const moltPost = await postToMoltbook({
    title: opts.title,
    body: opts.body,
    submolt: opts.submolt || DEFAULT_SUBMOLT,
  });

  // Step 2: Mint pod on-chain
  const { txHash, podId } = await mintPod({ skipApprove: opts.skipApprove || false });

  // Step 3: Submit metadata
  const description = opts.description || opts.body.slice(0, 200);
  const result = await submitMetadata({
    txHash,
    title: opts.title,
    description,
    url: moltPost.url,
    imageURL: opts.imageURL,
  });

  if (isJsonMode()) {
    outputResult({
      moltbook: moltPost,
      txHash,
      podId: podId?.toString() || null,
      txUrl: `https://basescan.org/tx/${txHash}`,
      metadata: result,
    });
  } else {
    console.log(`\nPublish complete!`);
    console.log(`  Moltbook: ${moltPost.url}`);
    console.log(`  Tx: https://basescan.org/tx/${txHash}`);
    if (podId !== undefined) console.log(`  Pod ID: ${podId}`);
  }
}
