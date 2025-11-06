# Инструкция по деплою на GitHub Pages

## ⚠️ Важно!

**GitHub Pages поддерживает только статические файлы (HTML, CSS, JS).** 
Ваш проект требует серверной части (Node.js, Express, Socket.IO, база данных), поэтому нужен отдельный хостинг для бэкенда.

## Варианты деплоя

### Вариант 1: GitHub Pages (фронтенд) + Отдельный хостинг (бэкенд) ✅ Рекомендуется

#### Шаг 1: Деплой бэкенда

Выберите один из сервисов:

**A) Render.com (бесплатно)**
1. Зарегистрируйтесь на https://render.com
2. Создайте новый "Web Service"
3. Подключите ваш GitHub репозиторий
4. Настройки:
   - Build Command: `npm install`
   - Start Command: `node server.js`
   - Environment Variables: `PORT=3000`
5. После деплоя получите URL типа: `https://your-app.onrender.com`

**B) Railway.app (бесплатно с ограничениями)**
1. Зарегистрируйтесь на https://railway.app
2. Создайте новый проект из GitHub
3. Railway автоматически определит Node.js проект
4. Получите URL после деплоя

**C) Heroku (платно, но есть бесплатные альтернативы)**
1. Установите Heroku CLI
2. `heroku create your-app-name`
3. `git push heroku main`
4. Получите URL: `https://your-app-name.herokuapp.com`

#### Шаг 2: Настройка фронтенда для GitHub Pages

1. **Обновите файлы с URL вашего бэкенда:**

В `login.html` раскомментируйте и укажите URL:
```html
<script>
    window.API_BASE_URL = 'https://your-backend-url.onrender.com';
</script>
```

В `index.html` добавьте перед подключением script.js:
```html
<script>
    window.API_BASE_URL = 'https://your-backend-url.onrender.com';
</script>
<script src="/socket.io/socket.io.js"></script>
<script src="script.js"></script>
```

2. **Обновите подключение Socket.IO в index.html:**
```html
<!-- Замените эту строку: -->
<script src="/socket.io/socket.io.js"></script>

<!-- На эту: -->
<script src="https://your-backend-url.onrender.com/socket.io/socket.io.js"></script>
```

3. **Закоммитьте и запушьте на GitHub:**
```bash
git add .
git commit -m "Configure for GitHub Pages deployment"
git push origin main
```

4. **Включите GitHub Pages:**
   - Перейдите в Settings → Pages
   - Source: `main` branch
   - Folder: `/ (root)`
   - Сохраните

### Вариант 2: Полный деплой на одном сервисе (проще)

Используйте сервис, который поддерживает Node.js:

**Render.com:**
- Просто задеплойте весь проект как Web Service
- Получите один URL для всего приложения
- Не нужен GitHub Pages

**Railway.app:**
- Аналогично Render
- Автоматический деплой из GitHub

**Vercel:**
- Поддерживает Node.js серверы
- Простой деплой через GitHub

## Настройка CORS

Убедитесь, что в `server.js` CORS настроен правильно:

```javascript
app.use(cors({
    origin: [
        'https://your-username.github.io',
        'http://localhost:3000'
    ],
    credentials: true
}));
```

## Настройка базы данных

SQLite файл будет создаваться на сервере. Для продакшена рассмотрите:
- PostgreSQL (Render, Railway поддерживают)
- MongoDB Atlas (бесплатный tier)
- Supabase (бесплатный PostgreSQL)

## Проверка работы

1. Откройте ваш сайт на GitHub Pages
2. Проверьте консоль браузера (F12) на ошибки
3. Убедитесь, что запросы идут на правильный URL бэкенда

## Проблемы и решения

**Проблема:** CORS ошибки
**Решение:** Обновите CORS настройки в server.js с вашим GitHub Pages URL

**Проблема:** Socket.IO не подключается
**Решение:** Убедитесь, что используете полный URL для Socket.IO скрипта

**Проблема:** База данных не работает
**Решение:** Проверьте права на запись в файловую систему на сервере

## Примеры конфигурации

### Для Render.com + GitHub Pages:

`login.html` и `index.html`:
```html
<script>
    window.API_BASE_URL = 'https://discord-clone-backend.onrender.com';
</script>
```

`index.html`:
```html
<script src="https://discord-clone-backend.onrender.com/socket.io/socket.io.js"></script>
```

### Для локальной разработки:

Оставьте пустым или используйте:
```html
<script>
    window.API_BASE_URL = 'http://localhost:3000';
</script>
```

