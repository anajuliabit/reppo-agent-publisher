import { postToMoltbook } from '../lib/moltbook.js';
import { validateTitle, validateBody } from '../lib/validate.js';
import { isJsonMode, outputResult } from '../lib/output.js';
import { DEFAULT_SUBMOLT } from '../constants.js';

export async function cmdPost(opts: {
  title: string;
  body: string;
  submolt?: string;
  dryRun?: boolean;
}): Promise<void> {
  validateTitle(opts.title);
  validateBody(opts.body);

  if (opts.dryRun) {
    const msg = `[dry-run] Would post to Moltbook (m/${opts.submolt || DEFAULT_SUBMOLT})`;
    if (isJsonMode()) {
      outputResult({ dryRun: true, submolt: opts.submolt || DEFAULT_SUBMOLT });
    } else {
      console.log(msg);
    }
    return;
  }

  const result = await postToMoltbook({
    title: opts.title,
    body: opts.body,
    submolt: opts.submolt || DEFAULT_SUBMOLT,
  });

  if (isJsonMode()) {
    outputResult(result);
  }
}
