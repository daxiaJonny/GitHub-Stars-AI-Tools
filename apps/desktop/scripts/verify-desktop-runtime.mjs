import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const projectRoot = new URL('..', import.meta.url).pathname;
const workspaceRoot = join(projectRoot, '..', '..');

const appSource = read('src/App.tsx');
const workspaceHook = read('src/hooks/use-stars-workspace.ts');
const tauriLib = read('src-tauri/src/lib.rs');
const tauriConfig = JSON.parse(read('src-tauri/tauri.conf.json'));
const defaultCapability = JSON.parse(read('src-tauri/capabilities/default.json'));
const desktopPackage = JSON.parse(read('package.json'));
const aclManifests = JSON.parse(read('src-tauri/gen/schemas/acl-manifests.json'));
const rootScripts = JSON.parse(readFromWorkspace('package.json')).scripts;

assert.equal(tauriConfig.productName, 'GitHub-Stars-AI-Tools', '发布包产品名必须是 GitHub-Stars-AI-Tools');
assert.equal(tauriConfig.app.windows[0].label, 'main', '主窗口必须显式声明 label，确保 capability 能稳定匹配');
assert.equal(tauriConfig.app.windows[0].title, 'GitHub-Stars-AI-Tools', '桌面窗口标题必须使用正式产品名');
assert.ok(tauriConfig.app.windows[0].minWidth <= 720, '窗口最小宽度必须允许小窗口自适应布局');
assert.ok(tauriConfig.app.windows[0].minHeight <= 560, '窗口最小高度必须允许小窗口自适应布局');
assert.deepEqual(
  tauriConfig.bundle.icon,
  [
    'icons/32x32.png',
    'icons/128x128.png',
    'icons/128x128@2x.png',
    'icons/icon.icns',
    'icons/icon.ico',
    'icons/icon.png',
  ],
  'Tauri 打包必须带上 macOS、Windows 和通用 PNG 应用图标',
);
for (const iconPath of tauriConfig.bundle.icon) {
  assert.ok(existsSync(join(projectRoot, 'src-tauri', iconPath)), `应用图标资源不存在：${iconPath}`);
}
assert.equal(defaultCapability.identifier, 'main-window', '必须提供主窗口 capability，避免发布态窗口无 IPC 权限');
assert.deepEqual(defaultCapability.windows, ['main'], '主窗口 capability 必须绑定 main 窗口');
assert.ok(defaultCapability.permissions.includes('core:default'), '主窗口 capability 必须允许 core:default，覆盖 IPC、事件监听和基础窗口能力');

const pinnedReleaseDependencies = {
  ...desktopPackage.dependencies,
  ...desktopPackage.devDependencies,
};
for (const dependencyName of [
  '@tauri-apps/api',
  '@tauri-apps/cli',
  '@vitejs/plugin-react',
  '@types/react',
  '@types/react-dom',
  'react',
  'react-dom',
  'typescript',
  'vite',
]) {
  assert.notEqual(
    pinnedReleaseDependencies[dependencyName],
    'latest',
    `${dependencyName} 不能使用 latest，正式发布必须固定到可复现版本`,
  );
}

const csp = tauriConfig.app.security.csp;
assert.match(csp, /default-src 'self'/, 'CSP 必须默认只允许本应用资源');
assert.match(csp, /connect-src[^;]*ipc:/, 'CSP 必须允许 Tauri IPC，否则发布态前端无法调用后端命令');
assert.match(csp, /img-src[^;]*https:/, 'CSP 必须允许 GitHub 头像和 README 中的 HTTPS 图片');
assert.match(csp, /img-src[^;]*data:/, 'CSP 必须允许内联图标或 README data 图片');
assert.match(csp, /script-src 'self'/, 'CSP 脚本来源必须收紧到本应用');
assert.match(csp, /frame-src 'none'/, 'CSP 必须禁止 iframe 嵌入');
assert.match(csp, /object-src 'none'/, 'CSP 必须禁止 object/embed 资源');

const eventPermissions = aclManifests['core:event']?.default_permission?.permissions ?? [];
assert.ok(eventPermissions.includes('allow-listen'), 'Tauri core:event 默认权限必须允许前端监听任务进度事件');
assert.ok(eventPermissions.includes('allow-unlisten'), 'Tauri core:event 默认权限必须允许前端释放任务进度监听');
assert.ok(eventPermissions.includes('allow-emit'), 'Tauri core:event 默认权限必须允许事件通道 emit');

assert.match(workspaceHook, /listen<TaskProgressEvent>\('task-progress'/, '前端必须监听 task-progress 事件');
assert.match(tauriLib, /const TASK_PROGRESS_EVENT: &str = "task-progress"/, '后端任务进度事件名必须和前端保持一致');
assert.match(tauriLib, /app_handle\.emit\(TASK_PROGRESS_EVENT, payload\)/, '后端必须通过 Tauri 事件发送任务进度');

assert.match(appSource, /document\.addEventListener\('click', handleExternalLinkClick\)/, '应用必须统一拦截外部链接点击');
assert.match(appSource, /closest<HTMLAnchorElement>\('a\[href\]'\)/, '外部链接拦截必须覆盖 README 和页面内所有 a[href]');
assert.match(appSource, /rawHref\.startsWith\('#'\)/, '外部链接拦截必须放过页面内 hash 链接');
assert.match(appSource, /function isSameDocumentHashLink\(url: string\)/, '外部链接拦截必须放过同文档 hash 链接');
assert.match(appSource, /\^https\?:\\\/\\\/.*i\.test\(url\)/, '前端只应把 http/https 链接交给系统浏览器');
assert.match(appSource, /invoke\('open_external_url', \{ url \}\)/, '外部链接必须优先通过后端安全命令打开');
assert.match(appSource, /window\.open\(url, '_blank', 'noopener,noreferrer'\)/, '后端打开失败时必须有安全降级路径');
assert.match(tauriLib, /fn open_external_url\(url: String\) -> Result<\(\), String>/, '后端必须提供 open_external_url 命令');
assert.match(tauriLib, /fn normalize_external_url\(url: &str\) -> Result<String, String>/, '后端打开外链前必须先归一化校验 URL');
assert.match(tauriLib, /normalized_url\.chars\(\)\.any\(char::is_control\)/, '外链校验必须拒绝控制字符');
assert.match(tauriLib, /starts_with\("https:\/\/"\).*starts_with\("http:\/\/"\)/s, '外链校验必须只允许 http 和 https');
assert.match(tauriLib, /open_external_url,/, 'open_external_url 必须注册到 Tauri invoke handler');
assert.match(tauriLib, /fn external_url_validation_allows_only_http_and_https/, '外链协议白名单必须有 Rust 单元测试覆盖');

assert.equal(rootScripts['package:desktop'], 'pnpm build:packages && pnpm --filter @gsat/desktop tauri build', 'package:desktop 必须先构建共享包，再生成真实 Tauri 安装包');
assert.equal(rootScripts['verify:release'], 'pnpm verify:tauri-release-config && pnpm package:desktop', 'release 验证必须生成真实安装包，不能只编译二进制');
assert.doesNotMatch(
  `${rootScripts['package:desktop']}\n${rootScripts['verify:release']}`,
  /--no-bundle/,
  '桌面发布脚本禁止使用 --no-bundle，不能只产出二进制文件',
);

console.log('Desktop runtime verification passed.');

function read(relativePath) {
  return readFileSync(join(projectRoot, relativePath), 'utf8');
}

function readFromWorkspace(relativePath) {
  return readFileSync(join(workspaceRoot, relativePath), 'utf8');
}
