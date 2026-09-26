const express = require('express');
const { body, validationResult } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const queries = require('../db/queries');

const router = express.Router();

router.get('/', (req, res) => {
  const { q, genre, minRating, status, sort } = req.query;

  const filters = {
    search: q ? q.trim() : '',
    genreId: genre ? Number(genre) : null,
    minRating: minRating ? Number(minRating) : null,
    status: ['single', 'ongoing', 'completed'].includes(status) ? status : '',
    sort: ['new', 'rating', 'title'].includes(sort) ? sort : 'new',
  };

  const entries = queries.listEntries(filters);
  const genres = queries.getAllGenres();

  res.render('entries/index', {
    entries,
    genres,
    filters: { q: q || '', genre: genre || '', minRating: minRating || '', status: status || '', sort: filters.sort },
  });
});

router.get('/entries/new', requireAuth, (req, res) => {
  res.render('entries/new', { errors: [], values: {}, genres: queries.getAllGenres() });
});

router.post(
  '/entries',
  requireAuth,
  [
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Укажите название'),
    body('author').trim().isLength({ min: 1, max: 200 }).withMessage('Укажите автора'),
    body('description')
      .trim()
      .isLength({ min: 20 })
      .withMessage('Описание должно быть не короче 20 символов'),
    body('cover_url')
      .optional({ checkFalsy: true })
      .isURL()
      .withMessage('Ссылка на обложку должна быть корректным URL'),
    body('series_status')
      .if(body('is_series').equals('on'))
      .isIn(['ongoing', 'completed'])
      .withMessage('Укажите статус цикла'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    const isSeries = req.body.is_series === 'on';
    const genreNames = []
      .concat(req.body.genres || [])
      .map((g) => g.trim())
      .filter(Boolean);
    const customGenre = (req.body.custom_genre || '').trim();
    if (customGenre) genreNames.push(customGenre);

    if (genreNames.length === 0) {
      errors.errors.push({ msg: 'Выберите хотя бы один жанр или укажите свой' });
    }

    if (!errors.isEmpty()) {
      return res.status(400).render('entries/new', {
        errors: errors.array(),
        values: req.body,
        genres: queries.getAllGenres(),
      });
    }

    const genreIds = genreNames.map((name) => queries.findOrCreateGenre(name).id);

    const entry = queries.createEntry({
      userId: req.user.id,
      title: req.body.title.trim(),
      author: req.body.author.trim(),
      description: req.body.description.trim(),
      isSeries,
      seriesStatus: isSeries ? req.body.series_status : null,
      volumesCount: isSeries && req.body.volumes_count ? Number(req.body.volumes_count) : null,
      coverUrl: req.body.cover_url ? req.body.cover_url.trim() : '',
      genreIds,
    });

    res.redirect(`/entries/${entry.id}`);
  }
);

router.get('/entries/:id', (req, res, next) => {
  const entry = queries.getEntryById(req.params.id);
  if (!entry) return next();

  const comments = queries.getCommentsByEntry(entry.id);
  const links = queries.getLinksByEntry(entry.id);
  const userRating = req.user ? queries.getUserRating(entry.id, req.user.id) : null;

  res.render('entries/show', {
    entry,
    comments,
    links,
    userRating,
    commentErrors: [],
    linkErrors: [],
  });
});

router.post(
  '/entries/:id/comments',
  requireAuth,
  [body('content').trim().isLength({ min: 1, max: 2000 }).withMessage('Комментарий не может быть пустым')],
  (req, res, next) => {
    const entry = queries.getEntryById(req.params.id);
    if (!entry) return next();

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const comments = queries.getCommentsByEntry(entry.id);
      const links = queries.getLinksByEntry(entry.id);
      const userRating = queries.getUserRating(entry.id, req.user.id);
      return res.status(400).render('entries/show', {
        entry,
        comments,
        links,
        userRating,
        commentErrors: errors.array(),
        linkErrors: [],
      });
    }

    queries.addComment(entry.id, req.user.id, req.body.content.trim());
    res.redirect(`/entries/${entry.id}#comments`);
  }
);

router.post('/entries/:id/rating', requireAuth, (req, res, next) => {
  const entry = queries.getEntryById(req.params.id);
  if (!entry) return next();

  const rating = Number(req.body.rating);
  if (rating >= 1 && rating <= 5) {
    queries.upsertRating(entry.id, req.user.id, rating);
  }
  res.redirect(`/entries/${entry.id}`);
});

router.post(
  '/entries/:id/links',
  requireAuth,
  [
    body('link_type').isIn(['purchase', 'download']).withMessage('Некорректный тип ссылки'),
    body('label').trim().isLength({ min: 1, max: 100 }).withMessage('Укажите название источника'),
    body('url').trim().isURL().withMessage('Укажите корректный URL'),
  ],
  (req, res, next) => {
    const entry = queries.getEntryById(req.params.id);
    if (!entry) return next();

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const comments = queries.getCommentsByEntry(entry.id);
      const links = queries.getLinksByEntry(entry.id);
      const userRating = queries.getUserRating(entry.id, req.user.id);
      return res.status(400).render('entries/show', {
        entry,
        comments,
        links,
        userRating,
        commentErrors: [],
        linkErrors: errors.array(),
      });
    }

    queries.addExternalLink(
      entry.id,
      req.user.id,
      req.body.link_type,
      req.body.label.trim(),
      req.body.url.trim()
    );
    res.redirect(`/entries/${entry.id}#links`);
  }
);

router.get('/profile', requireAuth, (req, res) => {
  const entries = queries.getEntriesByUser(req.user.id);
  res.render('users/profile', { entries });
});

module.exports = router;
