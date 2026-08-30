const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export function parseMessagePageQuery(query = {}) {
  const paginated = query.limit !== undefined || query.before !== undefined;
  if (!paginated) return { paginated: false, limit: null, before: null };

  const rawLimit = query.limit === undefined ? DEFAULT_LIMIT : Number(query.limit);
  if (!Number.isInteger(rawLimit) || rawLimit < 1) {
    const error = new Error('limit must be a positive integer');
    error.code = 'invalid_message_page';
    throw error;
  }

  let before = null;
  if (query.before !== undefined && query.before !== '') {
    before = Number(query.before);
    if (!Number.isInteger(before) || before < 1) {
      const error = new Error('before must be a positive message id');
      error.code = 'invalid_message_page';
      throw error;
    }
  }

  return { paginated: true, limit: Math.min(rawLimit, MAX_LIMIT), before };
}

export function readMessagePage(db, conversationId, page) {
  if (!page.paginated) {
    return {
      messages: db.prepare(`
        SELECT id, conversation_id, raw_id, role, content, images, created_at, event_id
        FROM messages WHERE conversation_id = ? ORDER BY id ASC
      `).all(conversationId),
      nextCursor: null,
      hasMore: false,
    };
  }

  const params = [conversationId];
  const beforeClause = page.before === null ? '' : ' AND id < ?';
  if (page.before !== null) params.push(page.before);
  params.push(page.limit + 1);
  const rows = db.prepare(`
    SELECT id, conversation_id, raw_id, role, content, images, created_at, event_id
    FROM messages
    WHERE conversation_id = ?${beforeClause}
    ORDER BY id DESC
    LIMIT ?
  `).all(...params);
  const hasMore = rows.length > page.limit;
  if (hasMore) rows.pop();
  rows.reverse();
  return {
    messages: rows,
    nextCursor: hasMore && rows.length > 0 ? rows[0].id : null,
    hasMore,
  };
}
