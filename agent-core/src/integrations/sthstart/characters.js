import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../../config.js';
import { fetchSthStart } from './client.js';
export { normalizePublicCharacterList } from './character-contract.js';

export const promptHash = (value) =>
  crypto.createHash('sha256').update(String(value || '')).digest('hex');

export async function publicCharacterRequest(pathname, init = {}) {
  if (!config.publicServices.appToken) {
    throw new Error('尚未为邻舍配置 SthStart 公共服务应用令牌');
  }
  const response = await fetchSthStart(
    `/api/v1/${pathname}`,
    init,
    15000
  );
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.message || body.error || `公共角色服务 HTTP ${response.status}`);
  }
  return body;
}

export function syncPublicRelationships(db, sourceCharacterId, relationships = []) {
  const active = new Set();
  for (const relation of relationships) {
    const from = db.prepare('SELECT id FROM characters WHERE source_character_id=?').get(relation.fromCharacterId);
    const to = db.prepare('SELECT id FROM characters WHERE source_character_id=?').get(relation.toCharacterId);
    if (!from || !to) continue;
    active.add(String(relation.id));
    const text = [relation.relationType && `【${relation.relationType}】`, relation.description].filter(Boolean).join(' ');
    const linked = db.prepare('SELECT local_relationship_id FROM public_character_relationship_links WHERE source_relationship_id=?').get(relation.id);
    if (linked) {
      db.prepare('UPDATE character_relationships SET relationship_text=? WHERE id=?').run(text, linked.local_relationship_id);
    } else {
      // 用户已经手工创建的同向关系优先，公共资料不会覆盖它
      if (db.prepare('SELECT 1 FROM character_relationships WHERE from_character_id=? AND to_character_id=?').get(from.id, to.id)) {
        continue;
      }
      const result = db.prepare('INSERT INTO character_relationships(from_character_id,to_character_id,relationship_text) VALUES (?,?,?)').run(from.id, to.id, text);
      db.prepare('INSERT INTO public_character_relationship_links VALUES (?,?,?,?)').run(relation.id, relation.fromCharacterId, relation.toCharacterId, result.lastInsertRowid);
    }
  }
  const stale = db.prepare('SELECT source_relationship_id,local_relationship_id FROM public_character_relationship_links WHERE source_from_character_id=? OR source_to_character_id=?').all(sourceCharacterId, sourceCharacterId);
  for (const item of stale) {
    if (!active.has(String(item.source_relationship_id))) {
      db.prepare('DELETE FROM character_relationships WHERE id=?').run(item.local_relationship_id);
      db.prepare('DELETE FROM public_character_relationship_links WHERE source_relationship_id=?').run(item.source_relationship_id);
    }
  }
}

export async function importPublicAvatar(avatarUrl, localId) {
  if (!avatarUrl) return null;
  try {
    const response = await fetchSthStart(avatarUrl, { method: 'GET' }, 15000);
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || 'image/png';
    const extension = contentType.includes('jpeg') ? 'jpg' : contentType.includes('webp') ? 'webp' : contentType.includes('gif') ? 'gif' : 'png';
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const projectRoot = path.dirname(path.dirname(path.dirname(__dirname)));
    const avatarsDir = path.join(projectRoot, 'data', 'avatars');
    fs.mkdirSync(avatarsDir, { recursive: true });
    const filename = `avatar_${localId}_public.${extension}`;
    fs.writeFileSync(path.join(avatarsDir, filename), Buffer.from(await response.arrayBuffer()));
    return `/avatars/${filename}`;
  } catch {
    return null;
  }
}
