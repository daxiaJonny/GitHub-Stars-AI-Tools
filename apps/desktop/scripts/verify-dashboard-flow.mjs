import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const projectRoot = new URL('..', import.meta.url).pathname;
const appSource = readFileSync(join(projectRoot, 'src', 'App.tsx'), 'utf8');
const dashboardPage = readFileSync(join(projectRoot, 'src', 'pages', 'dashboard.tsx'), 'utf8');

assert.match(
  dashboardPage,
  /onOpenSettings: \(\) => void/,
  '仪表盘必须暴露前往设置的回调，未连接 GitHub 时不能只显示禁用按钮',
);
assert.match(
  appSource,
  /<DashboardPage[\s\S]*?onOpenSettings=\{\(\) => setCurrentPage\('settings'\)\}/,
  'App 必须把仪表盘连接入口接到设置页',
);
assert.match(
  dashboardPage,
  /onClick=\{\(\) => \(workspace\.authState\.user \? void workspace\.handleSyncStars\(\) : props\.onOpenSettings\(\)\)\}/,
  '仪表盘同步按钮必须在未连接时跳转设置，在已连接时执行同步',
);
assert.match(
  dashboardPage,
  /disabled=\{workspace\.isSyncingStars\}/,
  '仪表盘同步按钮只能在同步中禁用，未连接账号时仍应可点击进入设置',
);
assert.match(
  dashboardPage,
  /title=\{workspace\.authState\.user \? '同步 GitHub Stars' : '前往设置连接 GitHub 账号'\}/,
  '仪表盘未连接状态必须明确提示会前往设置连接 GitHub',
);

console.log('Dashboard flow verification passed.');
