import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { parseMessagePageQuery, readMessagePage } from '../src/services/messagePagination.js';

function fixture() {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE messages (
    id INTEGER PRIMARY KEY, conversation_id TEXT NOT NULL, raw_id INTEGER,
    role TEXT NOT NULL, content TEXT NOT NULL, images TEXT, created_at TEXT, event_id INTEGER
  )`);
  const insert = db.prepare("INSERT INTO messages VALUES (?, 'char_1', NULL, 'user', ?, NULL, ?, NULL)");
  for (let id = 1; id <= 125; id++) insert.run(id, `message-${id}`, `2026-01-01 00:${String(id % 60).padStart(2, '0')}:00`);
  return db;
}

test('returns the newest page in ascending display order', () => {
  const db = fixture();
  const result = readMessagePage(db, 'char_1', parseMessagePageQuery({ limit: '50' }));
  assert.equal(result.messages.length, 50);
  assert.deepEqual([result.messages[0].id, result.messages.at(-1).id], [76, 125]);
  assert.equal(result.nextCursor, 76);
  assert.equal(result.hasMore, true);
  db.close();
});

test('uses the cursor without duplicates and reports the final page', () => {
  const db = fixture();
  const middle = readMessagePage(db, 'char_1', parseMessagePageQuery({ limit: '50', before: '76' }));
  assert.deepEqual([middle.messages[0].id, middle.messages.at(-1).id], [26, 75]);
  assert.equal(middle.nextCursor, 26);
  const oldest = readMessagePage(db, 'char_1', parseMessagePageQuery({ limit: '50', before: '26' }));
  assert.deepEqual([oldest.messages[0].id, oldest.messages.at(-1).id], [1, 25]);
  assert.equal(oldest.nextCursor, null);
  assert.equal(oldest.hasMore, false);
  db.close();
});

test('keeps the legacy unpaginated response and validates query values', () => {
  const db = fixture();
  assert.equal(readMessagePage(db, 'char_1', parseMessagePageQuery({})).messages.length, 125);
  assert.equal(parseMessagePageQuery({ limit: '1000' }).limit, 100);
  assert.throws(() => parseMessagePageQuery({ limit: '0' }), /positive integer/);
  assert.throws(() => parseMessagePageQuery({ before: 'bad' }), /positive message id/);
  db.close();
});
