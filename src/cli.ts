#!/usr/bin/env bun

const DEFAULT_BASE_URL = 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function write(s: string): void {
  process.stdout.write(s + '\n');
}

function usage(): never {
  write(
    [
      `Usage: bun run cli [--base-url URL] [--auth USER:PASS] <command> [args...]`,
      ``,
      `Commands:`,
      `  images list   [--page N] [--limit N] [--sort COL] [--order asc|desc]`,
      `                [--include-tags IDS] [--exclude-tags IDS] [--tag-mode and|or]`,
      `  images search QUERY [--page N] [--limit N]`,
      `                [--include-tags IDS] [--exclude-tags IDS] [--tag-mode and|or]`,
      `  images get    ID`,
      `  images update ID --title TITLE`,
      `  images file   ID          (writes binary to stdout)`,
      `  images thumb  ID          (writes binary to stdout)`,
      `  images tag    IMAGE_ID TAG_ID`,
      `  images untag  IMAGE_ID TAG_ID`,
      `  images bulk-tag --ids 1,2,3 --tag-id TAG_ID`,
      ``,
      `  tags list`,
      `  tags create   NAME`,
      `  tags delete   ID`,
      ``,
      `  sync run`,
      `  sync status`,
      ``,
      `Options:`,
      `  --base-url URL     Server URL (default: ${DEFAULT_BASE_URL})`,
      `  --auth USER:PASS   Basic auth credentials`,
      `  -h, --help         Show this help`,
    ].join('\n'),
  );
  process.exit(1);
}

function die(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function requireArg(val: string | undefined, label: string): string {
  if (val === undefined || val === '') {
    die(`missing ${label}`);
  }
  return val;
}

function requireFlag(flags: Map<string, string>, key: string): string {
  const val = flags.get(key);
  if (val === undefined || val === '') {
    die(`missing ${key}`);
  }
  return val;
}

function parseArgs(argv: string[]): { flags: Map<string, string>; positional: string[] } {
  const flags = new Map<string, string>();
  const positional: string[] = [];
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i] ?? '';
    if (arg === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith('--')) {
      const key = arg;
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags.set(key, '');
        i += 1;
      } else {
        flags.set(key, next);
        i += 2;
      }
    } else {
      positional.push(arg);
      i += 1;
    }
  }
  return { flags, positional };
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

interface ClientOpts {
  baseUrl: string;
  auth: string | undefined;
}

async function request(
  opts: ClientOpts,
  method: string,
  path: string,
  options?: { query?: Record<string, string>; body?: unknown; binary?: boolean },
): Promise<unknown> {
  const url = new URL(path, opts.baseUrl);
  if (options?.query !== undefined) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== '') url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {};
  if (opts.auth !== undefined) {
    headers['Authorization'] = `Basic ${btoa(opts.auth)}`;
  }
  if (options?.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const fetchInit: RequestInit = { method, headers };
  if (options?.body !== undefined) {
    fetchInit.body = JSON.stringify(options.body);
  }

  const res = await fetch(url.toString(), fetchInit);

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    die(`${method} ${path} → ${String(res.status)} ${res.statusText}\n${text}`);
  }

  if (options?.binary === true) {
    const buf = await res.arrayBuffer();
    await Bun.write(Bun.stdout, new Uint8Array(buf));
    return null;
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Output helper
// ---------------------------------------------------------------------------

function printJson(data: unknown): void {
  write(JSON.stringify(data, null, 2));
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdImagesList(client: ClientOpts, flags: Map<string, string>): Promise<void> {
  const query: Record<string, string> = {};
  for (const key of ['page', 'limit', 'sort', 'order', 'includeTags', 'excludeTags', 'tagMode']) {
    const flag = `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
    const val = flags.get(flag);
    if (val !== undefined) query[key] = val;
  }
  printJson(await request(client, 'GET', '/api/images', { query }));
}

async function cmdImagesSearch(
  client: ClientOpts,
  flags: Map<string, string>,
  positional: string[],
): Promise<void> {
  const q = requireArg(positional[0], 'search query');
  const query: Record<string, string> = { q };
  for (const key of ['page', 'limit', 'includeTags', 'excludeTags', 'tagMode']) {
    const flag = `--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
    const val = flags.get(flag);
    if (val !== undefined) query[key] = val;
  }
  printJson(await request(client, 'GET', '/api/images/search', { query }));
}

async function cmdImagesGet(client: ClientOpts, positional: string[]): Promise<void> {
  const id = requireArg(positional[0], 'image ID');
  printJson(await request(client, 'GET', `/api/images/${id}`));
}

async function cmdImagesUpdate(
  client: ClientOpts,
  flags: Map<string, string>,
  positional: string[],
): Promise<void> {
  const id = requireArg(positional[0], 'image ID');
  const title = requireFlag(flags, '--title');
  printJson(await request(client, 'PATCH', `/api/images/${id}`, { body: { title } }));
}

async function cmdImagesFile(client: ClientOpts, positional: string[]): Promise<void> {
  const id = requireArg(positional[0], 'image ID');
  await request(client, 'GET', `/api/images/${id}/file`, { binary: true });
}

async function cmdImagesThumb(client: ClientOpts, positional: string[]): Promise<void> {
  const id = requireArg(positional[0], 'image ID');
  await request(client, 'GET', `/api/images/${id}/thumb`, { binary: true });
}

async function cmdImagesTag(client: ClientOpts, positional: string[]): Promise<void> {
  const imageId = requireArg(positional[0], 'IMAGE_ID');
  const tagId = requireArg(positional[1], 'TAG_ID');
  printJson(
    await request(client, 'POST', `/api/images/${imageId}/tags`, {
      body: { tag_id: Number(tagId) },
    }),
  );
}

async function cmdImagesUntag(client: ClientOpts, positional: string[]): Promise<void> {
  const imageId = requireArg(positional[0], 'IMAGE_ID');
  const tagId = requireArg(positional[1], 'TAG_ID');
  printJson(await request(client, 'DELETE', `/api/images/${imageId}/tags/${tagId}`));
}

async function cmdImagesBulkTag(client: ClientOpts, flags: Map<string, string>): Promise<void> {
  const idsStr = requireFlag(flags, '--ids');
  const tagIdStr = requireFlag(flags, '--tag-id');
  const imageIds = idsStr.split(',').map(Number);
  const tagId = Number(tagIdStr);
  printJson(
    await request(client, 'POST', '/api/images/bulk/tags', { body: { imageIds, tagId } }),
  );
}

async function cmdTagsList(client: ClientOpts): Promise<void> {
  printJson(await request(client, 'GET', '/api/tags'));
}

async function cmdTagsCreate(client: ClientOpts, positional: string[]): Promise<void> {
  const name = requireArg(positional[0], 'tag name');
  printJson(await request(client, 'POST', '/api/tags', { body: { name } }));
}

async function cmdTagsDelete(client: ClientOpts, positional: string[]): Promise<void> {
  const id = requireArg(positional[0], 'tag ID');
  printJson(await request(client, 'DELETE', `/api/tags/${id}`));
}

async function cmdSyncRun(client: ClientOpts): Promise<void> {
  printJson(await request(client, 'POST', '/api/sync'));
}

async function cmdSyncStatus(client: ClientOpts): Promise<void> {
  printJson(await request(client, 'GET', '/api/sync/status'));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.length === 0 || rawArgs.includes('-h') || rawArgs.includes('--help')) {
    usage();
  }

  const { flags, positional } = parseArgs(rawArgs);

  const client: ClientOpts = {
    baseUrl: flags.get('--base-url') ?? DEFAULT_BASE_URL,
    auth: flags.get('--auth'),
  };

  flags.delete('--base-url');
  flags.delete('--auth');

  const group = positional[0] ?? '';
  const cmd = positional[1] ?? '';
  const rest = positional.slice(2);

  switch (group) {
    case 'images':
      switch (cmd) {
        case 'list':
          return cmdImagesList(client, flags);
        case 'search':
          return cmdImagesSearch(client, flags, rest);
        case 'get':
          return cmdImagesGet(client, rest);
        case 'update':
          return cmdImagesUpdate(client, flags, rest);
        case 'file':
          return cmdImagesFile(client, rest);
        case 'thumb':
          return cmdImagesThumb(client, rest);
        case 'tag':
          return cmdImagesTag(client, rest);
        case 'untag':
          return cmdImagesUntag(client, rest);
        case 'bulk-tag':
          return cmdImagesBulkTag(client, flags);
        default:
          die(`unknown images command: ${cmd}`);
      }
      break;
    case 'tags':
      switch (cmd) {
        case 'list':
          return cmdTagsList(client);
        case 'create':
          return cmdTagsCreate(client, rest);
        case 'delete':
          return cmdTagsDelete(client, rest);
        default:
          die(`unknown tags command: ${cmd}`);
      }
      break;
    case 'sync':
      switch (cmd) {
        case 'run':
          return cmdSyncRun(client);
        case 'status':
          return cmdSyncStatus(client);
        default:
          die(`unknown sync command: ${cmd}`);
      }
      break;
    default:
      die(`unknown command group: ${group}`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
