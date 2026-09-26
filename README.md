# КнигоФорум

Веб-платформа в формате форума для любителей книг: описания книг и циклов,
поиск/фильтрация по жанру и рейтингу, оценки, комментарии и ссылки на
покупку/скачивание. Подробности — в [PRD.md](PRD.md).

## Стек

Node.js + Express (SSR), EJS, SQLite (`better-sqlite3`), сессии в SQLite
(`connect-sqlite3`), `bcryptjs`, `express-validator`, чистый CSS.

## Запуск

```bash
npm install
npm run seed
npm start
```

Приложение поднимется на [http://localhost:3000](http://localhost:3000).

Тестовые пользователи после `npm run seed`:

- `anna@example.com` / `password123`
- `max@example.com` / `password123`

## Структура

См. раздел 5.1 в [PRD.md](PRD.md).

База данных и файл сессий хранятся в `data/` (создаётся автоматически,
не коммитится).
