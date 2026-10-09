// Starts MetaKit on this computer with one command: checks Node, installs or updates the
// dependencies, starts the web app and opens it in the browser. MetaKit has no server or
// database, so the web app is the whole system.
//
//   node scripts/start.js              development server with live reload (default)
//   node scripts/start.js --preview    production build, served as GitHub Pages would
//   node scripts/start.js --port 5200  another port (or set PORT)
//   node scripts/start.js --no-install skip the dependency check
//   node scripts/start.js --no-open    do not open the browser

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const preview = flag('--preview');
const install = !flag('--no-install');
const open = !flag('--no-open');
const port =
  option('--port') ?? process.env.PORT ?? (preview ? '4173' : '5173');

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

const [major] = process.versions.node.split('.').map(Number);
if (major < 22)
  fail(
    `MetaKit needs Node.js 22 or newer; this is ${process.versions.node}. Get it from https://nodejs.org.`,
  );

if (!/^\d+$/.test(port)) fail(`"${port}" is not a port number.`);

// pnpm.cmd on Windows only runs through a shell, which takes the command as one string. Every
// part here is fixed text or the checked port number, so nothing needs quoting.
const shell = process.platform === 'win32';
const spawnArgs = (parts) =>
  shell ? [parts.join(' '), []] : [parts[0], parts.slice(1)];
const run = (parts, options = {}) =>
  spawnSync(...spawnArgs(parts), {
    cwd: root,
    stdio: 'inherit',
    shell,
    ...options,
  });

// pnpm comes with Node through Corepack when it is not installed on its own.
let pnpm = ['pnpm'];
if (run(['pnpm', '--version'], { stdio: 'ignore' }).status !== 0) {
  if (run(['corepack', 'pnpm', '--version'], { stdio: 'ignore' }).status !== 0)
    fail(
      'pnpm was not found. Install it with "npm install -g pnpm" or enable it with "corepack enable".',
    );
  pnpm = ['corepack', 'pnpm'];
}
const pnpmRun = (args) => run([...pnpm, ...args]);

// Always run: it takes about a second when nothing changed, and after a pull it links new
// workspace packages that would otherwise be missing.
if (install || !existsSync(join(root, 'node_modules'))) {
  console.log('Checking dependencies…');
  if (pnpmRun(['install']).status !== 0)
    fail('Installing the dependencies failed.');
}

if (preview) {
  console.log('Building the web app…');
  if (pnpmRun(['--filter', '@metakit-app/web', 'build']).status !== 0)
    fail('The build failed.');
}

const url = `http://localhost:${port}/`;
console.log(
  `\nStarting MetaKit at ${url}\nUse Chrome or Edge on a desktop: MetaKit needs their folder access.\nPress Ctrl+C to stop.\n`,
);

const server = spawn(
  ...spawnArgs([
    ...pnpm,
    '--filter',
    '@metakit-app/web',
    preview ? 'preview' : 'dev',
    '--port',
    port,
    '--strictPort',
    ...(open ? ['--open'] : []),
  ]),
  { cwd: root, stdio: 'inherit', shell },
);

const stop = () => server.kill('SIGINT');
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', (code) => process.exit(code ?? 0));
