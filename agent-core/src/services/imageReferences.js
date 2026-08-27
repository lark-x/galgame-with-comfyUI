import path from 'path';
import { saveBase64Image } from './imagePaths.js';

// Public image results are deliberately represented by a small, durable reference.
// The browser-facing URL is a neighbour-local proxy, so signed SthStart URLs never
// get persisted in the neighbour database and never expire inside old messages.
export function isArtifactImage(value) {
  return Boolean(value && typeof value === 'object' && typeof value.artifactId === 'string' && value.artifactId.trim());
}

export function artifactImageUrl(artifactId) {
  return `/api/images/artifacts/${encodeURIComponent(String(artifactId))}`;
}

export function toArtifactImageReference(value) {
  if (!isArtifactImage(value)) return null;
  const artifactId = value.artifactId.trim();
  const byteSize = Number(value.byteSize);
  return {
    artifactId,
    // Always derive the browser URL locally. Never persist or render an URL
    // supplied by a public-service response as an arbitrary remote image.
    url: artifactImageUrl(artifactId),
    contentType: typeof value.contentType === 'string' ? value.contentType : null,
    filename: typeof value.filename === 'string' ? path.basename(value.filename) : null,
    ...(Number.isFinite(byteSize) && byteSize >= 0 ? { byteSize } : {}),
  };
}

/**
 * Persist a generated image without assuming the result is local base64.
 * Central artifact references are stored as objects; standalone results retain
 * the old local-file behaviour for compatibility.
 */
export function persistGeneratedImage(value, category, filename) {
  const reference = toArtifactImageReference(value);
  if (reference) return reference;
  if (typeof value?.base64 !== 'string' || value.base64.length === 0) return null;
  // ComfyUI output names are provider-controlled. Keep the legacy local-file
  // path compatibility without allowing a result filename to escape its
  // configured image directory.
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
