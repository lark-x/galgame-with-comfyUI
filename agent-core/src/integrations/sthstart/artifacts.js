import path from 'path';
import { saveBase64Image } from '../../services/imagePaths.js';

/**
 * 判断是否为 SthStart Artifact 产物引用
 */
export function isArtifactImage(value) {
  return Boolean(value && typeof value === 'object' && typeof value.artifactId === 'string' && value.artifactId.trim());
}

/**
 * 生成邻舍本地代理 URL（不将带有 Token 的 SthStart 原生 URL 暴露给浏览器）
 */
export function artifactImageUrl(artifactId) {
  return `/api/images/artifacts/${encodeURIComponent(String(artifactId))}`;
}

/**
 * 转换为规范的 Artifact 引用对象
 */
export function toArtifactImageReference(value) {
  if (!isArtifactImage(value)) return null;
  const artifactId = value.artifactId.trim();
  const byteSize = Number(value.byteSize);
  return {
    artifactId,
    url: artifactImageUrl(artifactId),
    contentType: typeof value.contentType === 'string' ? value.contentType : null,
    filename: typeof value.filename === 'string' ? path.basename(value.filename) : null,
    ...(Number.isFinite(byteSize) && byteSize >= 0 ? { byteSize } : {}),
  };
}

/**
 * 持久化生成的图片：如果是 Artifact 引用则保存结构；如果是 base64 则存为本地文件
 */
export function persistGeneratedImage(value, category, filename) {
  const reference = toArtifactImageReference(value);
  if (reference) return reference;
  if (typeof value?.base64 !== 'string' || value.base64.length === 0) return null;
  const safeFilename = path.basename(String(filename || 'image.png')) || 'image.png';
  return saveBase64Image(category, safeFilename, value.base64);
}

export function imageDisplayUrl(value) {
  if (typeof value === 'string') return value;
  if (isArtifactImage(value)) return artifactImageUrl(value.artifactId);
  return typeof value?.url === 'string' ? value.url : '';
}

export function toClientImage(value) {
  const reference = toArtifactImageReference(value);
  return reference || value;
}

export function imageIdentity(value) {
  if (isArtifactImage(value)) return `artifact:${value.artifactId}`;
  return imageDisplayUrl(value);
}

export function parseImageValues(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value && typeof value === 'object') return [value];
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}
