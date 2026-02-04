import { MOLTBOOK_API, DEFAULT_SUBMOLT } from '../constants.js';
import { loadKey } from './config.js';
import { fetchJSON } from './http.js';
import type { MoltbookPostResponse, MoltbookResult } from '../types.js';

export async function postToMoltbook({
  title,
  body,
  submolt,
}: {
  title: string;
  body: string;
  submolt?: string;
}): Promise<MoltbookResult> {
  const key = loadKey('moltbook_key');
  if (!key) throw new Error('Moltbook API key not found. Set MOLTBOOK_API_KEY or create ~/.config/reppo/moltbook_key');

  console.log(`Posting to Moltbook (m/${submolt || DEFAULT_SUBMOLT})...`);
  const data = await fetchJSON<MoltbookPostResponse>(`${MOLTBOOK_API}/posts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: JSON.stringify({ title, body, ...(submolt && { submolt }) }),
  });

  const url = data.url || `https://moltbook.com/post/${data.id}`;
  console.log(`Posted to Moltbook: ${url}`);
  return { id: data.id, url };
}
