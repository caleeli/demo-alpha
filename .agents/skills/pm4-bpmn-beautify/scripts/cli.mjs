#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { readFile, writeFile, lstat, realpath } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { beautify, inspect, parse } from './beautify.mjs';
import { preview } from './preview.mjs';

const help = `pm4-bpmn-beautify — local BPMN presentation tools (Node >=20)

  node scripts/cli.mjs report input.bpmn [--output report.json]
  node scripts/cli.mjs beautify input.bpmn --output elegant.bpmn
    [--report report.json] [--preview preview.svg]
    [--theme professional|monochrome|preserve]
    [--layout auto|preserve] [--subprocesses collapsed|expanded|preserve]
    [--direction LR|TB] [--spacing comfortable|compact]

Defaults: auto layout, professional colors, collapsed subprocesses, LR.
Output files must be new; inputs are never overwritten. No network or live API writes.
Preserve layout changes colors only, retaining sizes and expansion states.
Full layout: one process or collaboration, pools, nested lanes, message flows,
nested subprocesses, boundary events, branches and cycles.
Message endpoints inside subprocesses keep those ancestors expanded.
Annotations/data artifacts: report or --layout preserve only.
`;
try {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    help: { type: 'boolean', short: 'h' }, output: { type: 'string', short: 'o' },
    report: { type: 'string' }, preview: { type: 'string' }, theme: { type: 'string' },
    layout: { type: 'string' }, subprocesses: { type: 'string' }, direction: { type: 'string' }, spacing: { type: 'string' },
  } });
  if (values.help) { console.log(help); }
  else {
    const [command, input] = positionals;
    if (!['report', 'beautify'].includes(command) || !input || positionals.length !== 2) throw new Error(help);
    if (command === 'beautify' && !values.output) throw new Error('beautify requires --output (input is never overwritten).');
    if (command === 'report' && Object.keys(values).some(k => !['output'].includes(k))) throw new Error('report accepts only --output.');
    const inputPath = await realpath(input), files = new Map(), paths = new Set();
    // Preflight all output destinations, including aliased directories and dangling symlinks.
    for (const key of ['output', 'report', 'preview']) if (values[key]) {
      const full = resolve(values[key]);
      const canonical = resolve(await realpath(dirname(full)), basename(full));
      if (canonical === inputPath || paths.has(canonical)) throw new Error(`Output paths must be distinct from input and each other: ${full}`);
      paths.add(canonical);
      try { await lstat(full); throw new Error(`Refusing to overwrite existing path: ${full}`); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const xml = await readFile(inputPath, 'utf8');
    if (command === 'report') {
      const result = JSON.stringify(inspect(parse(xml)), null, 2) + '\n';
      if (values.output) files.set(values.output, result); else process.stdout.write(result);
    } else {
      const options = Object.fromEntries(['theme', 'layout', 'subprocesses', 'direction', 'spacing'].filter(k => values[k]).map(k => [k, values[k]]));
      const result = await beautify(xml, options);
      files.set(values.output, result.xml);
      if (values.report) files.set(values.report, JSON.stringify(result.report, null, 2) + '\n');
      if (values.preview) files.set(values.preview, preview(result.xml));
      console.error(JSON.stringify(result.report, null, 2));
    }
    for (const [path, content] of files) await writeFile(path, content, { flag: 'wx' });
  }
} catch (error) { console.error(`pm4-bpmn-beautify: ${error.message}`); process.exitCode = 1; }
