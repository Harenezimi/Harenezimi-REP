const { getUserById } = require('../db/queries');

function attachUser(req, res, next) {
  if (req.session && req.session.userId) {
    const user = getUserById(req.session.userId);
    if (user) {
      req.user = user;
      res.locals.user = user;
      return next();
    }
  }
  req.user = null;
  res.locals.user = null;
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login');
  }
  next();
}

module.exports = { attachUser, requireAuth };
