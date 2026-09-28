import { spawn } from 'node:child_process';
const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';
const children = [
  spawn(npm, ['--prefix','frontend','run','dev'], { stdio:'inherit', shell:false }),
  spawn(npm, ['--prefix','backend','run','dev'], { stdio:'inherit', shell:false })
];
const stop = () => children.forEach(c => c.kill('SIGINT'));
process.on('SIGINT', () => { stop(); process.exit(0); });
process.on('SIGTERM', () => { stop(); process.exit(0); });
