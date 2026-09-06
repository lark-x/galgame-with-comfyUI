import { config } from '../../config.js';
import { fetchSthStart } from './client.js';

export function isSthStartManaged() {
  return Boolean(config.publicServices.llm);
}

export async function getPublicLlmStatus() {
  if (!config.publicServices.llm) {
    return {
      managed: false,
      connected: false,
      status: 'disabled',
      error: null,
      text: null,
      multimodal: null,
      ready: false,
      portalUrl: config.publicServices.portalUrl,
    };
  }

  if (!config.publicServices.appToken) {
    return {
      managed: true,
      connected: false,
      status: 'unreachable',
      error: '缺少 STHSTART_APP_TOKEN 授权令牌',
      text: null,
      multimodal: null,
      ready: false,
      portalUrl: config.publicServices.portalUrl,
    };
  }

  try {
    const res = await fetchSthStart('/api/v1/app/config', { method: 'GET' }, 5000);
    if (!res.ok) {
      const errPayload = await res.json().catch(() => ({}));
      const errMsg = errPayload.message || errPayload.error || `HTTP ${res.status}`;
      return {
        managed: true,
        connected: false,
        status: 'unreachable',
        error: `SthStart 公共服务返回异常 (${errMsg})`,
        text: null,
        multimodal: null,
        ready: false,
        portalUrl: config.publicServices.portalUrl,
      };
    }

    const data = await res.json();
    return {
      managed: true,
      connected: true,
      status: 'connected',
      error: null,
      text: data.llm?.text || null,
      multimodal: data.llm?.multimodal || null,
      ready: Boolean(data.llm?.ready),
      portalUrl: config.publicServices.portalUrl,
    };
  } catch (error) {
    const msg = error?.code === 'ETIMEDOUT' ? '连接 SthStart 公共服务超时' : (error?.message || '无法连接 SthStart 公共服务');
    return {
      managed: true,
      connected: false,
      status: 'unreachable',
      error: msg,
      text: null,
      multimodal: null,
      ready: false,
      portalUrl: config.publicServices.portalUrl,
    };
  }
}
