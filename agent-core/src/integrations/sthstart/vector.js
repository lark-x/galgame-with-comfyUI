import { config } from '../../config.js';
import { fetchSthStart } from './client.js';

export function isSthStartVectorManaged() {
  return Boolean(config.publicServices.vector && config.publicServices.appToken);
}

export async function requestSthStartVector(route, body, timeoutMs) {
  const headers = {
    'Content-Type': 'application/json',
    ...(config.publicServices.vectorProfile ? { 'X-SthStart-Profile': config.publicServices.vectorProfile } : {}),
  };

  return await fetchSthStart(
    `/api/v1/vector/${route}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...body, namespace: 'linshe-memory', purpose: 'memory' }),
    },
    timeoutMs
  );
}
