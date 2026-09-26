const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const { createUser, findUserByEmail, findUserByUsername } = require('../db/queries');

const router = express.Router();

router.get('/register', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('auth/register', { errors: [], values: {} });
});

router.post(
  '/register',
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 30 })
      .withMessage('Имя пользователя должно быть от 3 до 30 символов')
      .matches(/^[a-zA-Zа-яА-Я0-9_]+$/)
      .withMessage('Имя пользователя может содержать только буквы, цифры и «_»'),
    body('email').trim().isEmail().withMessage('Введите корректный email').normalizeEmail(),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Пароль должен быть не короче 6 символов'),
    body('passwordConfirm').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Пароли не совпадают');
      }
      return true;
    }),
  ],
  (req, res) => {
    const errors = validationResult(req);
    const { username, email, password } = req.body;

    if (!errors.isEmpty()) {
      return res.status(400).render('auth/register', {
        errors: errors.array(),
        values: { username, email },
      });
    }

    if (findUserByEmail(email)) {
      return res.status(400).render('auth/register', {
        errors: [{ msg: 'Пользователь с таким email уже зарегистрирован' }],
        values: { username, email },
      });
    }

    if (findUserByUsername(username)) {
      return res.status(400).render('auth/register', {
        errors: [{ msg: 'Это имя пользователя уже занято' }],
        values: { username, email },
      });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const user = createUser({ username, email, passwordHash });

    req.session.userId = user.id;
    res.redirect('/');
  }
);

router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/');
  res.render('auth/login', { errors: [], values: {} });
});

router.post(
  '/login',
  [
    body('email').trim().notEmpty().withMessage('Введите email').normalizeEmail(),
    body('password').notEmpty().withMessage('Введите пароль'),
  ],
  (req, res) => {
    const errors = validationResult(req);
    const { email, password } = req.body;

    if (!errors.isEmpty()) {
      return res.status(400).render('auth/login', { errors: errors.array(), values: { email } });
    }

    const user = findUserByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(400).render('auth/login', {
        errors: [{ msg: 'Неверный email или пароль' }],
        values: { email },
      });
    }

    req.session.userId = user.id;
    const returnTo = req.session.returnTo;
    delete req.session.returnTo;
    res.redirect(returnTo || '/');
  }
);

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;
