import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const projectRoot = new URL('..', import.meta.url).pathname;
const sourceRoot = join(projectRoot, 'src');
const tauriLibPath = join(projectRoot, 'src-tauri', 'src', 'lib.rs');
const capabilityPath = join(projectRoot, 'src-tauri', 'capabilities', 'default.json');
const permissionsRoot = join(projectRoot, 'src-tauri', 'permissions');

function collectSourceFiles(directory) {
  const entries = readdirSync(directory);
  return entries.flatMap((entry) => {
    const fullPath = join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      return collectSourceFiles(fullPath);
    }
    return /\.(ts|tsx)$/.test(entry) ? [fullPath] : [];
  });
}

function collectFrontendCommands() {
  const commands = new Set();
  for (const filePath of collectSourceFiles(sourceRoot)) {
    const source = readFileSync(filePath, 'utf8');
    for (const command of collectInvokeCommands(source)) {
      commands.add(command);
    }
  }
  return commands;
}

function collectInvokeCommands(source) {
  const commands = [];
  let index = 0;

  while (index < source.length) {
    const invokeIndex = source.indexOf('invoke', index);
    if (invokeIndex === -1) {
      break;
    }
    index = invokeIndex + 'invoke'.length;
    if (isIdentifierChar(source[invokeIndex - 1]) || isIdentifierChar(source[index])) {
      continue;
    }

    let cursor = skipWhitespace(source, index);
    if (source[cursor] === '<') {
      cursor = skipTypeArguments(source, cursor);
      if (cursor === -1) {
        continue;
      }
      cursor = skipWhitespace(source, cursor);
    }
    if (source[cursor] !== '(') {
      continue;
    }

    cursor = skipWhitespace(source, cursor + 1);
    const quote = source[cursor];
    if (quote !== '\'' && quote !== '"') {
      continue;
    }

    const end = source.indexOf(quote, cursor + 1);
    if (end === -1) {
      continue;
    }
    commands.push(source.slice(cursor + 1, end));
    index = end + 1;
  }

  return commands;
}

function skipTypeArguments(source, start) {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === '<') {
      depth += 1;
    } else if (char === '>') {
      depth -= 1;
      if (depth === 0) {
        return index + 1;
      }
    }
  }
  return -1;
}

function skipWhitespace(source, start) {
  let index = start;
  while (/\s/.test(source[index] ?? '')) {
    index += 1;
  }
  return index;
}

function isIdentifierChar(value) {
  return typeof value === 'string' && /[A-Za-z0-9_$]/.test(value);
}

function collectRegisteredCommands() {
  const source = readFileSync(tauriLibPath, 'utf8');
  const handlerBlock = source.match(/generate_handler!\[([\s\S]*?)\]\)/)?.[1];
  if (!handlerBlock) {
    throw new Error('未找到 Tauri generate_handler 注册列表');
  }

  return new Set(
    [...handlerBlock.matchAll(/\b([a-z][a-z0-9_]*)\b/g)]
      .map((match) => match[1])
      .filter((command) => command !== 'tauri'),
  );
}

function collectAllowedCommands() {
  const capability = JSON.parse(readFileSync(capabilityPath, 'utf8'));
  const capabilityPermissionIds = new Set(
    capability.permissions.filter((permission) => typeof permission === 'string'),
  );
  const permissionCommandMap = collectPermissionCommandMap();
  const allowedCommands = new Set();

  for (const permissionId of capabilityPermissionIds) {
    if (!permissionId.includes(':')) {
      allowedCommands.add(permissionId);
    }
    for (const command of permissionCommandMap.get(permissionId) ?? []) {
      allowedCommands.add(command);
    }
  }

  return allowedCommands;
}

function collectPermissionCommandMap() {
  const permissionCommandMap = new Map();

  for (const filePath of collectTomlFiles(permissionsRoot)) {
    const source = readFileSync(filePath, 'utf8');
    for (const block of source.split(/\[\[permission\]\]/).slice(1)) {
      const identifier = block.match(/identifier\s*=\s*"([^"]+)"/)?.[1];
      const commandsBlock = block.match(/commands\.allow\s*=\s*\[([\s\S]*?)\]/)?.[1];
      if (!identifier || !commandsBlock) {
        continue;
      }

      const commands = [...commandsBlock.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
      permissionCommandMap.set(identifier, commands);
    }
  }

  return permissionCommandMap;
}

function collectTomlFiles(directory) {
  const entries = readdirSync(directory);
  return entries.flatMap((entry) => {
    const fullPath = join(directory, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      return collectTomlFiles(fullPath);
    }
    return entry.endsWith('.toml') ? [fullPath] : [];
  });
}

const frontendCommands = collectFrontendCommands();
const registeredCommands = collectRegisteredCommands();
const allowedCommands = collectAllowedCommands();
const missingCommands = [...frontendCommands].filter((command) => !registeredCommands.has(command)).sort();
const unauthorizedCommands = [...frontendCommands].filter((command) => !allowedCommands.has(command)).sort();

if (missingCommands.length > 0) {
  console.error(`前端调用缺少 Tauri 注册命令：${missingCommands.join(', ')}`);
  process.exit(1);
}

if (unauthorizedCommands.length > 0) {
  console.error(`前端调用缺少 Tauri capability 授权：${unauthorizedCommands.join(', ')}`);
  process.exit(1);
}

console.log(`Tauri 命令覆盖校验通过：${frontendCommands.size} 个前端调用均已注册并授权。`);
