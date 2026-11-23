// Entry for a make.fun video-on-X bounty (Node 22, standard library only).
//
// The entry itself is the X post: the agent made a short video on the
// bounty's subject, ending with make.fun's referral end card, and posted it
// natively on X from a public account whose text carries make.fun (or
// @makefunai) plus a play code. This program's only job is to hand the
// post's address to the gate: it reads POST.json from the repository root
// and writes it to the output directory as POST.json.
//
// POST.json must look like this (the post's address, as X's Share button
// gives it — handle plus numeric id, nothing else):
//   {"url": "https://x.com/<handle>/status/<id>"}
//
// Local run (mirrors what the grader does, with its own directories):
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
// Afterwards out/POST.json is byte for byte the repository's POST.json.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Where the repository lives inside the grader, and where the gate looks
// for the result. Both can be pointed elsewhere for a local run.
const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const SOURCE_PATH = join(BOT_DIR, 'POST.json');
const DEST_PATH = join(OUTPUT_DIR, 'POST.json');

// Read the post descriptor and check it is really one, before anything is
// written. A bad POST.json must fail loudly here instead of silently
// handing the gate a file it cannot use.
function loadPostDescriptor(path: string): { url: string; raw: string } {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    throw new Error(
      `could not read POST.json at ${path}: ${(err as Error).message}. ` +
        `Make sure POST.json sits in the repository root (${resolve(BOT_DIR)}) ` +
        `and names the X post as {"url": "https://x.com/<handle>/status/<id>"}.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `POST.json at ${path} is not valid JSON: ${(err as Error).message}. ` +
        `It must contain exactly {"url": "https://x.com/<handle>/status/<id>"}.`,
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      `POST.json at ${path} must be a JSON object with a "url" field, ` +
        `not ${Array.isArray(parsed) ? 'an array' : typeof parsed}.`,
    );
  }

  const url = (parsed as Record<string, unknown>).url;
  if (typeof url !== 'string' || url.trim() === '') {
    throw new Error(
      `POST.json at ${path} must have a "url" field holding a non-empty string, ` +
        `e.g. {"url": "https://x.com/<handle>/status/<id>"}.`,
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url.trim());
  } catch {
    throw new Error(
      `POST.json "url" is not a valid URL: ${JSON.stringify(url)}. ` +
        `Expected something like https://x.com/<handle>/status/<id>.`,
    );
  }

  if (parsedUrl.protocol !== 'https:') {
    throw new Error(
      `POST.json "url" must use https, not ${parsedUrl.protocol}: ${url}.`,
    );
  }

  const host = parsedUrl.hostname.toLowerCase();
  if (host !== 'x.com' && host !== 'twitter.com' && host !== 'www.x.com' && host !== 'www.twitter.com') {
    throw new Error(
      `POST.json "url" must point at x.com (or twitter.com), not ${host}: ${url}.`,
    );
  }

  // An X post address is /<handle>/status/<digits>. Anything else is
  // probably not a post the house can read — warn about it, but do not
  // refuse it here: the repository ships a placeholder address
  // (https://x.com/<handle>/status/<id>) that the documented local run
  // must still accept, and refusing a post is the gate's job at submit
  // time, not this program's. A warning is enough to catch a typo.
  const segments = parsedUrl.pathname.split('/').filter((part) => part !== '');
  const isPostAddress =
    segments.length === 3 &&
    segments[1] === 'status' &&
    /^\d+$/.test(segments[2]);
  if (!isPostAddress) {
    console.warn(
      `warning: POST.json "url" does not look like an X post address: ${url}. ` +
        `Expected https://x.com/<handle>/status/<id> with a numeric id.`,
    );
  }

  return { url: url.trim(), raw };
}

function main(): void {
  const descriptor = loadPostDescriptor(SOURCE_PATH);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Write the source through byte for byte. The documented contract is
  // that out/POST.json is identical to the repository's POST.json, and
  // re-serialising would silently reformat it (spacing, trailing newline).
  // Validation already happened on the parsed content above; the bytes
  // themselves are passed on untouched.
  try {
    writeFileSync(DEST_PATH, descriptor.raw, 'utf8');
  } catch (err) {
    throw new Error(
      `could not write POST.json to ${DEST_PATH}: ${(err as Error).message}.`,
    );
  }

  console.log(`Wrote ${DEST_PATH} for post ${descriptor.url}`);
}

try {
  main();
} catch (err) {
  console.error(`error: ${(err as Error).message}`);
  process.exit(1);
}
