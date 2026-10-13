import { config } from '../../config.js';

/**
 * 统一发起 SthStart 公共服务请求
 */
export async function fetchSthStart(path, options = {}, timeoutMs = 10000) {
  const baseURL = config.publicServices.baseURL;
  const token = config.publicServices.appToken;
  const url = `${baseURL}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = {
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    return res;
  } catch (error) {
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      const timeoutErr = new Error(`SthStart 请求超时 (${timeoutMs}ms) [${path}]`);
      timeoutErr.code = 'ETIMEDOUT';
      throw timeoutErr;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
