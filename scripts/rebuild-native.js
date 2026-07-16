/**
 * Rebuild native modules (better-sqlite3, node-pty) for the bundled Electron ABI.
 * Uses a local .venv Python when available (helps on Python 3.12+ without distutils).
 */
const { execSync } = require('child_process')
const { existsSync } = require('fs')
const { join } = require('path')

const root = join(__dirname, '..')
const venvPython = join(root, '.venv', 'bin', 'python')
const env = { ...process.env }

if (existsSync(venvPython)) {
  env.PYTHON = venvPython
  env.npm_config_python = venvPython
}

try {
  execSync('electron-builder install-app-deps', {
    cwd: root,
    env,
    stdio: 'inherit'
  })
} catch (err) {
  console.warn(
    '[forgex] Native module rebuild failed. Ensure build tools and setuptools are available.'
  )
  console.warn(
    '  Tip: python3 -m venv .venv && .venv/bin/pip install setuptools && pnpm install'
  )
  // Do not fail install entirely — modules may already match Electron prebuilds
  process.exitCode = 0
}
