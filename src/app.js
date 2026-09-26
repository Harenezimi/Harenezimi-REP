const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);

const { attachUser } = require('./middleware/auth');
const authRoutes = require('./routes/auth');
const entryRoutes = require('./routes/entries');

const app = express();
const PORT = process.env.PORT || 3000;
const dataDir = path.join(__dirname, '..', 'data');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(
  session({
    store: new SQLiteStore({ dir: dataDir, db: 'sessions.sqlite' }),
    secret: process.env.SESSION_SECRET || 'knigoforum-dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
    },
  })
);

app.use(attachUser);

app.use('/', authRoutes);
app.use('/', entryRoutes);

app.use((req, res) => {
  res.status(404).render('errors/404', { title: 'Страница не найдена' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('errors/500', { title: 'Ошибка сервера' });
});

app.listen(PORT, () => {
  console.log(`КнигоФорум запущен: http://localhost:${PORT}`);
});
