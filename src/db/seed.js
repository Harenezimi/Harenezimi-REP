const bcrypt = require('bcryptjs');
const db = require('./index');
const queries = require('./queries');

function resetData() {
  db.exec(`
    DELETE FROM external_links;
    DELETE FROM comments;
    DELETE FROM ratings;
    DELETE FROM entry_genres;
    DELETE FROM entries;
    DELETE FROM users;
  `);
}

function run() {
  resetData();

  const passwordHash = bcrypt.hashSync('password123', 10);

  const anna = queries.createUser({
    username: 'anna',
    email: 'anna@example.com',
    passwordHash,
  });
  const max = queries.createUser({
    username: 'max',
    email: 'max@example.com',
    passwordHash,
  });

  const genres = Object.fromEntries(
    queries.getAllGenres().map((g) => [g.name, g.id])
  );

  const witcher = queries.createEntry({
    userId: anna.id,
    title: 'Ведьмак',
    author: 'Анджей Сапковский',
    description:
      'Цикл фэнтези-романов о ведьмаке Геральте из Ривии, охотнике на чудовищ, ' +
      'живущем в мрачном мире, где грань между добром и злом почти неразличима. ' +
      'Отличное сочетание мифологии, политики и живых персонажей.',
    isSeries: true,
    seriesStatus: 'completed',
    volumesCount: 8,
    coverUrl: '',
    genreIds: [genres['Фэнтези'], genres['Приключения']].filter(Boolean),
  });

  const dark = queries.createEntry({
    userId: max.id,
    title: 'Тёмная башня',
    author: 'Стивен Кинг',
    description:
      'Эпический цикл, смешивающий фэнтези, вестерн и ужасы. История стрелка ' +
      'Роланда, идущего к Тёмной башне через параллельные миры. Масштабно, ' +
      'местами страшно, местами трогательно.',
    isSeries: true,
    seriesStatus: 'ongoing',
    volumesCount: null,
    coverUrl: '',
    genreIds: [genres['Фэнтези'], genres['Ужасы']].filter(Boolean),
  });

  const oneShot = queries.createEntry({
    userId: anna.id,
    title: 'Убийство в «Восточном экспрессе»',
    author: 'Агата Кристи',
    description:
      'Классический детектив с Эркюлем Пуаро. Закрытое пространство, ' +
      'ограниченный круг подозреваемых и один из самых неожиданных финалов ' +
      'в истории жанра.',
    isSeries: false,
    seriesStatus: null,
    volumesCount: null,
    coverUrl: '',
    genreIds: [genres['Детектив']].filter(Boolean),
  });

  const ya = queries.createEntry({
    userId: max.id,
    title: 'Голодные игры',
    author: 'Сьюзен Коллинз',
    description:
      'YA-цикл про антиутопию, где подростки вынуждены сражаться на арене ' +
      'на выживание. Динамичный сюжет и сильная главная героиня — Китнисс Эвердин.',
    isSeries: true,
    seriesStatus: 'completed',
    volumesCount: 4,
    coverUrl: '',
    genreIds: [genres['Young Adult'], genres['Приключения']].filter(Boolean),
  });

  queries.upsertRating(witcher.id, anna.id, 5);
  queries.upsertRating(witcher.id, max.id, 5);
  queries.upsertRating(dark.id, anna.id, 4);
  queries.upsertRating(oneShot.id, max.id, 5);
  queries.upsertRating(oneShot.id, anna.id, 4);
  queries.upsertRating(ya.id, anna.id, 4);
  queries.upsertRating(ya.id, max.id, 3);

  queries.addComment(witcher.id, max.id, 'Один из лучших циклов фэнтези, must read!');
  queries.addComment(witcher.id, anna.id, 'Сериал не передал и десятой доли атмосферы книг.');
  queries.addComment(dark.id, anna.id, 'Начало сильное, но некоторые тома читаются тяжело.');
  queries.addComment(oneShot.id, max.id, 'Перечитываю каждые пару лет, до сих пор держит интригу.');

  queries.addExternalLink(witcher.id, anna.id, 'purchase', 'Litres', 'https://www.litres.ru/');
  queries.addExternalLink(oneShot.id, max.id, 'purchase', 'Bookmate', 'https://bookmate.ru/');

  console.log('База данных заполнена демо-данными.');
  console.log('Пользователи: anna@example.com / max@example.com, пароль: password123');
}

run();
