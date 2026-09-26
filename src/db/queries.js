const db = require('./index');

const DEFAULT_GENRES = [
  'Фэнтези',
  'Научная фантастика',
  'Детектив',
  'Роман',
  'Триллер',
  'Ужасы',
  'Приключения',
  'История',
  'Young Adult',
  'Non-fiction',
];

function ensureDefaultGenres() {
  const insert = db.prepare('INSERT OR IGNORE INTO genres (name) VALUES (?)');
  const tx = db.transaction((names) => {
    for (const name of names) insert.run(name);
  });
  tx(DEFAULT_GENRES);
}

ensureDefaultGenres();

// ---------- Users ----------

function createUser({ username, email, passwordHash }) {
  const stmt = db.prepare(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)'
  );
  const info = stmt.run(username, email, passwordHash);
  return getUserById(info.lastInsertRowid);
}

function getUserById(id) {
  return db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(id);
}

function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email);
}

function findUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

// ---------- Genres ----------

function getAllGenres() {
  return db.prepare('SELECT * FROM genres ORDER BY name ASC').all();
}

function findOrCreateGenre(name) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const existing = db.prepare('SELECT * FROM genres WHERE name = ? COLLATE NOCASE').get(trimmed);
  if (existing) return existing;
  const info = db.prepare('INSERT INTO genres (name) VALUES (?)').run(trimmed);
  return { id: info.lastInsertRowid, name: trimmed };
}

// ---------- Entries ----------

function createEntry({
  userId,
  title,
  author,
  description,
  isSeries,
  seriesStatus,
  volumesCount,
  coverUrl,
  genreIds,
}) {
  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO entries (user_id, title, author, description, is_series, series_status, volumes_count, cover_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        userId,
        title,
        author,
        description,
        isSeries ? 1 : 0,
        isSeries ? seriesStatus : null,
        isSeries && volumesCount ? volumesCount : null,
        coverUrl || null
      );
    const entryId = info.lastInsertRowid;
    const insertGenre = db.prepare(
      'INSERT OR IGNORE INTO entry_genres (entry_id, genre_id) VALUES (?, ?)'
    );
    for (const genreId of genreIds) {
      insertGenre.run(entryId, genreId);
    }
    return entryId;
  });
  const entryId = tx();
  return getEntryById(entryId);
}

const ENTRY_BASE_SELECT = `
  SELECT
    e.*,
    u.username AS author_username,
    COALESCE(AVG(r.rating), 0) AS avg_rating,
    COUNT(DISTINCT r.id) AS rating_count
  FROM entries e
  JOIN users u ON u.id = e.user_id
  LEFT JOIN ratings r ON r.entry_id = e.id
`;

function attachGenres(entry) {
  if (!entry) return entry;
  const genres = db
    .prepare(
      `SELECT g.* FROM genres g
       JOIN entry_genres eg ON eg.genre_id = g.id
       WHERE eg.entry_id = ?
       ORDER BY g.name ASC`
    )
    .all(entry.id);
  return { ...entry, genres };
}

function getEntryById(id) {
  const entry = db
    .prepare(`${ENTRY_BASE_SELECT} WHERE e.id = ? GROUP BY e.id`)
    .get(id);
  return attachGenres(entry);
}

function listEntries({ search, genreId, minRating, status, sort } = {}) {
  const clauses = [];
  const params = {};

  if (search) {
    clauses.push('(e.title LIKE @search OR e.author LIKE @search)');
    params.search = `%${search}%`;
  }

  if (status === 'single') {
    clauses.push('e.is_series = 0');
  } else if (status === 'ongoing') {
    clauses.push('e.is_series = 1 AND e.series_status = \'ongoing\'');
  } else if (status === 'completed') {
    clauses.push('e.is_series = 1 AND e.series_status = \'completed\'');
  }

  if (genreId) {
    clauses.push(
      'e.id IN (SELECT entry_id FROM entry_genres WHERE genre_id = @genreId)'
    );
    params.genreId = genreId;
  }

  let sql = ENTRY_BASE_SELECT;
  if (clauses.length) {
    sql += ` WHERE ${clauses.join(' AND ')}`;
  }
  sql += ' GROUP BY e.id';

  if (minRating) {
    sql += ' HAVING avg_rating >= @minRating';
    params.minRating = minRating;
  }

  const sortMap = {
    new: 'e.created_at DESC',
    rating: 'avg_rating DESC, rating_count DESC',
    title: 'e.title ASC COLLATE NOCASE',
  };
  sql += ` ORDER BY ${sortMap[sort] || sortMap.new}`;

  const rows = db.prepare(sql).all(params);
  return rows.map(attachGenres);
}

function getEntriesByUser(userId) {
  const rows = db
    .prepare(`${ENTRY_BASE_SELECT} WHERE e.user_id = ? GROUP BY e.id ORDER BY e.created_at DESC`)
    .all(userId);
  return rows.map(attachGenres);
}

// ---------- Ratings ----------

function upsertRating(entryId, userId, rating) {
  db.prepare(
    `INSERT INTO ratings (entry_id, user_id, rating) VALUES (?, ?, ?)
     ON CONFLICT(entry_id, user_id) DO UPDATE SET rating = excluded.rating`
  ).run(entryId, userId, rating);
}

function getUserRating(entryId, userId) {
  const row = db
    .prepare('SELECT rating FROM ratings WHERE entry_id = ? AND user_id = ?')
    .get(entryId, userId);
  return row ? row.rating : null;
}

// ---------- Comments ----------

function addComment(entryId, userId, content) {
  db.prepare('INSERT INTO comments (entry_id, user_id, content) VALUES (?, ?, ?)').run(
    entryId,
    userId,
    content
  );
}

function getCommentsByEntry(entryId) {
  return db
    .prepare(
      `SELECT c.*, u.username FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.entry_id = ?
       ORDER BY c.created_at ASC`
    )
    .all(entryId);
}

// ---------- External links ----------

function addExternalLink(entryId, userId, linkType, label, url) {
  db.prepare(
    `INSERT INTO external_links (entry_id, user_id, link_type, label, url)
     VALUES (?, ?, ?, ?, ?)`
  ).run(entryId, userId, linkType, label, url);
}

function getLinksByEntry(entryId) {
  return db
    .prepare(
      `SELECT l.*, u.username FROM external_links l
       JOIN users u ON u.id = l.user_id
       WHERE l.entry_id = ? AND l.is_approved = 1
       ORDER BY l.created_at DESC`
    )
    .all(entryId);
}

module.exports = {
  DEFAULT_GENRES,
  createUser,
  getUserById,
  findUserByEmail,
  findUserByUsername,
  getAllGenres,
  findOrCreateGenre,
  createEntry,
  getEntryById,
  listEntries,
  getEntriesByUser,
  upsertRating,
  getUserRating,
  addComment,
  getCommentsByEntry,
  addExternalLink,
  getLinksByEntry,
};
