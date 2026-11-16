import { execFileSync } from 'node:child_process';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, relative, sep } from 'node:path';

const postsDir = 'content/posts';
const files = (await readdir(postsDir)).filter((name) => name.endsWith('.md')).sort();

function scalar(value) {
  const text = value.trim();
  if (text.startsWith('"') && text.endsWith('"')) {
    try { return JSON.parse(text); } catch { return text.slice(1, -1); }
  }
  if (text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1).replaceAll("''", "'");
  return text;
}

function gitDates(file) {
  try {
    const result = execFileSync('git', ['log', '--follow', '--format=%aI', '--', file], { encoding: 'utf8' });
    const dates = result.trim().split(/\r?\n/).filter(Boolean);
    return { updatedAt: dates[0] || null, createdAt: dates.at(-1) || null };
  } catch {
    return { createdAt: null, updatedAt: null };
  }
}

const posts = [];
for (const name of files) {
  const path = join(postsDir, name);
  const raw = (await readFile(path, 'utf8')).replace(/^\uFEFF/, '').replace(/\r/g, '');
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  const fields = {};
  if (fm) {
    for (const line of fm[1].split('\n')) {
      const match = line.match(/^([\w-]+):\s*(.*)$/);
      if (match) fields[match[1]] = scalar(match[2]);
    }
  }
  const body = (fm ? raw.slice(fm[0].length) : raw).trim();
  const git = gitDates(path.split(sep).join('/'));
  const fallbackDate = fields.date || name.slice(0, 10);
  posts.push({
    id: basename(name, '.md'),
    title: fields.title || basename(name, '.md'),
    date: fallbackDate,
    category: fields.category || '随手记录',
    summary: fields.summary || body.slice(0, 120),
    coverImage: fields.coverImage || '',
    body,
    minutes: Math.max(1, Math.ceil(body.length / 300)),
    createdAt: git.createdAt || fallbackDate,
    updatedAt: git.updatedAt || git.createdAt || fallbackDate,
    source: relative('.', path).split(sep).join('/'),
  });
}

await writeFile('posts.json', `${JSON.stringify(posts, null, 2)}\n`, 'utf8');
console.log(`Generated posts.json from ${posts.length} Markdown files.`);

