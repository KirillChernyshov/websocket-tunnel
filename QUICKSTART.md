# 🚀 WebSocket Tunnel - Quick Setup

## ✅ Что готово:
- [x] TypeScript проект с полной типизацией
- [x] WebSocket сервер и клиент
- [x] HTTP Proxy система
- [x] Управление клиентами и переподключение
- [x] Heartbeat мониторинг
- [x] Обработка ошибок
- [x] Тестовый сервер
- [x] Интеграционные тесты

## 🔧 Быстрый запуск (тестирование):

```bash
# 1. Установить зависимости
npm install

# 2. Проверить типизацию
npm run type-check

# 3. Собрать проект
npm run build

# В отдельных терминалах:
# Терминал 1: Тестовый сервер (ваше приложение)
npm run dev:test-server

# Терминал 2: Туннель сервер (рабочий сервер)  
npm run dev:server

# Терминал 3: Туннель клиент (ваш ПК)
npm run dev:client

# Терминал 4: Тесты
curl http://localhost:3000/api/test
curl -X POST http://localhost:3000/api/echo -H "Content-Type: application/json" -d '{"test":true}'
```

## 🌐 Продакшн развертывание:

### На рабочем сервере:
```bash
# 1. Скопировать проект
git clone <your-repo>
cd websocket-tunnel

# 2. Настроить окружение
cp .env.example .env
# Отредактировать .env:
PORT=3000
WS_PORT=3001

# 3. Установить и запустить
npm install --production
npm run build
npm run start:server
```

### На вашем ПК:
```bash
# 1. Настроить окружение
cp .env.example .env
# Отредактировать .env:
SERVER_WS_URL=ws://your-work-server.com:3001
LOCAL_TARGET=http://localhost:8080
CLIENT_ID=my-pc-client

# 2. Запустить
npm run build
npm run start:client
```

## 🔍 Мониторинг:
- `http://work-server:3000/health` - статус системы
- `http://work-server:3000/status` - подключенные клиенты
- Логи в консоли с эмодзи для удобства

## 📊 Тестирование:
```bash
# Автоматический интеграционный тест
npm run test:integration

# Ручные тесты
curl http://localhost:3000/api/test
curl http://localhost:3000/health
curl http://localhost:3000/status
```

## ⚙️ Конфигурация:

| Параметр | Сервер | Клиент | Описание |
|----------|--------|--------|----------|
| PORT | 3000 | - | HTTP порт сервера |
| WS_PORT | 3001 | - | WebSocket порт |
| SERVER_WS_URL | - | ws://server:3001 | Адрес сервера |
| LOCAL_TARGET | - | http://localhost:8080 | Локальное приложение |
| CLIENT_ID | - | unique-id | ID клиента |

## 🛠 Архитектура:
```
[Другой сервер] 
    ↓ HTTP запрос
[Рабочий сервер:3000] 
    ↓ WebSocket
[Ваш ПК (клиент)] 
    ↓ HTTP запрос  
[Локальное приложение:8080]
```

## 🔧 Расширение:
- Добавить HTTPS/WSS поддержку
- Улучшить систему балансировки
- Добавить аутентификацию
- Интегрировать с PM2/systemd
- Добавить метрики и алерты
