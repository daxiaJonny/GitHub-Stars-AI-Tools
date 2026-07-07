import type { AISettings } from '@/types-settings';

export const SAVED_AI_API_KEY_PLACEHOLDER = '__GSAT_SAVED_AI_API_KEY__';

export type BackendAiRequestConfig = Pick<AISettings, 'provider' | 'baseUrl' | 'model'> & {
  apiKey: '';
};

export function toBackendAiRequestConfig(ai: AISettings): BackendAiRequestConfig {
  return {
    provider: ai.provider,
    baseUrl: ai.baseUrl,
    apiKey: '',
    model: ai.model,
  };
}

export function shouldFlushAiApiKey(ai: AISettings): boolean {
  const apiKey = ai.apiKey.trim();
  if (ai.provider === 'none' || isSavedAiApiKeyPlaceholder(apiKey)) {
    return false;
  }

  if (ai.provider === 'openai-compatible' && isLocalAiBaseUrl(ai.baseUrl) && !apiKey) {
    return false;
  }

  return true;
}

export function getAiConfigMessage(ai: AISettings): string | null {
  if (ai.provider === 'none') {
    return 'AI 功能尚未配置，请在设置中选择 OpenAI、OpenAI 兼容接口或 Anthropic，并填写模型 ID。OpenAI 与 Anthropic 还需要 API Key，OpenAI 兼容接口需要请求地址。';
  }

  const baseUrl = ai.baseUrl.trim();
  if (ai.provider === 'openai-compatible' && !baseUrl) {
    return '请填写 OpenAI 兼容接口的请求地址。';
  }

  if (baseUrl && !isAllowedAiBaseUrl(baseUrl)) {
    return 'AI 请求地址必须使用 https://；只有本机调试地址可以使用 http://。';
  }

  if (!ai.model.trim()) {
    return '请先在设置中填写 AI 模型 ID。';
  }

  if (!hasUsableAiApiKey(ai.apiKey) && !canUseAiWithoutApiKey(ai, baseUrl)) {
    return '请先在设置中填写 AI API Key。';
  }

  return null;
}

export function isSavedAiApiKeyPlaceholder(apiKey: string) {
  return apiKey === SAVED_AI_API_KEY_PLACEHOLDER;
}

function hasUsableAiApiKey(apiKey: string) {
  return isSavedAiApiKeyPlaceholder(apiKey) || apiKey.trim().length > 0;
}

function canUseAiWithoutApiKey(ai: AISettings, baseUrl: string) {
  return ai.provider === 'openai-compatible' && isLocalAiBaseUrl(baseUrl);
}

function isAllowedAiBaseUrl(baseUrl: string) {
  if (/^https:\/\//i.test(baseUrl)) {
    return true;
  }

  if (!/^http:\/\//i.test(baseUrl)) {
    return false;
  }

  try {
    const url = new URL(baseUrl);
    return ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function isLocalAiBaseUrl(baseUrl: string) {
  try {
    const url = new URL(baseUrl);
    return ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}
