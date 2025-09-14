# WebSocket Tunnel Project

## План реализации

### Архитектура системы
```
[Другой сервер] -> HTTP запрос -> [Рабочий сервер] -> WebSocket -> [Ваш ПК] -> HTTP запрос -> [Локальное приложение]
                                        ^                              |
                                        |<-- WebSocket ответ <--------|
```

### Компоненты системы

#### 1. Рабочий сервер (src/server/)
- **HTTP сервер** на Express.js для приема внешних запросов
- **WebSocket сервер** для связи с клиентами (вашими ПК)
- **Очередь запросов** для буферизации запросов при недоступности клиента
- **Маршрутизатор** для распределения запросов между клиентами

#### 2. Клиент на ПК (src/client/)
- **WebSocket клиент** для подключения к рабочему серверу
- **HTTP клиент** для выполнения локальных запросов
- **Система переподключения** при обрывах соединения
- **Обработчик запросов** для преобразования WebSocket сообщений в HTTP

### Протокол взаимодействия

#### Типы сообщений WebSocket:
```typescript
interface TunnelMessage {
  id: string;
  type: 'request' | 'response' | 'error' | 'heartbeat' | 'register';
  timestamp: number;
  payload?: any;
}

interface HttpRequestPayload {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
  query?: Record<string, string>;
}

interface HttpResponsePayload {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}
```

### Этапы реализации

#### Этап 1: Базовая функциональность ✅
- [x] Создать структуру проекта
- [x] WebSocket сервер на рабочем сервере
- [x] WebSocket клиент на ПК
- [x] Базовый HTTP proxy функционал
- [x] Система типов TypeScript
- [x] Управление клиентами
- [x] Тестовый сервер

#### Этап 2: Надежность
- [ ] Очередь запросов с таймаутами
- [ ] Переподключение при обрыве связи
- [ ] Heartbeat для контроля соединения
- [ ] Обработка ошибок

#### Этап 3: Расширенный функционал
- [ ] Поддержка множественных клиентов
- [ ] Балансировка нагрузки
- [ ] Логирование и мониторинг
- [ ] Конфигурация через файлы

#### Этап 4: Безопасность
- [ ] Аутентификация клиентов
- [ ] HTTPS/WSS соединения
- [ ] Ограничение доступа по IP
- [ ] Шифрование сообщений

### Структура файлов
```
src/
├── server/
│   ├── index.ts           # Основной файл сервера
│   ├── websocket.ts       # WebSocket сервер
│   ├── http-proxy.ts      # HTTP proxy логика
│   ├── client-manager.ts  # Управление клиентами
│   └── types.ts           # Типы TypeScript
├── client/
│   ├── index.ts           # Основной файл клиента
│   ├── websocket.ts       # WebSocket клиент
│   ├── http-client.ts     # HTTP клиент
│   └── config.ts          # Конфигурация
└── shared/
    └── types.ts           # Общие типы
```

### Конфигурация

#### Сервер (.env):
```
PORT=3000
WS_PORT=3001
TARGET_URL=http://localhost:8080
```

#### Клиент (.env):
```
SERVER_WS_URL=ws://your-work-server:3001
LOCAL_TARGET=http://localhost:8080
CLIENT_ID=pc-client-1
```

### Запуск и использование

1. **Установка зависимостей:**
   ```bash
   npm install
   ```

2. **Сборка проекта:**
   ```bash
   npm run build
   ```

3. **Запуск сервера (на рабочем сервере):**
   ```bash
   npm run start:server
   ```

4. **Запуск клиента (на вашем ПК):**
   ```bash
   npm run start:client
   ```

### Тестирование
```bash
# Отправка тестового запроса на рабочий сервер
curl -X POST http://work-server:3000/api/test \
  -H "Content-Type: application/json" \
  -d '{"message": "hello"}'
```

### Мониторинг
- WebSocket соединения в реальном времени
- Статистика запросов и ответов
- Лог ошибок и переподключений
- Время отклика туннеля

## Быстрый старт

### 1. Установка зависимостей
```bash
npm install
```

### 2. Тестирование на локальной машине

**Терминал 1 - Запуск тестового сервера (имитация вашего приложения):**
```bash
npm run dev:test-server
# Сервер запустится на http://localhost:8080
```

**Терминал 2 - Запуск туннель-сервера (имитация рабочего сервера):**
```bash
npm run dev:server
# HTTP сервер на порту 3000, WebSocket на 3001
```

**Терминал 3 - Запуск клиента (ваш ПК):**
```bash
npm run dev:client
# Подключится к локальному серверу из терминала 2
```

### 3. Тестирование туннеля

**В терминале 4 - Отправка тестовых запросов:**
```bash
# Простой GET запрос
curl http://localhost:3000/api/test

# POST запрос с данными
curl -X POST http://localhost:3000/api/echo \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello through tunnel!"}'

# PUT запрос с параметрами
curl -X PUT http://localhost:3000/api/data/123?version=2 \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Item"}'

# Тестирование медленного запроса
curl "http://localhost:3000/api/slow?delay=3000"

# Тестирование ошибок
curl http://localhost:3000/api/error/404
```

### 4. Проверка статуса системы
```bash
# Статус туннеля
curl http://localhost:3000/health

# Информация о подключенных клиентах
curl http://localhost:3000/status
```

## 🚀 Продакшн деплой

### Быстрый деплой (PM2)

**На рабочем сервере:**
```bash
# Автоматический деплой сервера
./deploy.sh server
```

**На вашем ПК:**
```bash
# Настроить .env и запустить клиент
echo "SERVER_WS_URL=ws://your-server.com:3001" > .env
echo "LOCAL_TARGET=http://localhost:8080" >> .env
./deploy.sh client
```

### Мониторинг
```bash
# Статус процессов
pm2 list

# Логи в реальном времени
pm2 logs

# Проверка здоровья системы
./health-check.sh

# Мониторинг производительности
pm2 monit
```

📚 **Подробные инструкции:**
- 🎯 [**DEPLOY.md**](./DEPLOY.md) - Быстрый старт для продакшена
- 📖 [**PRODUCTION.md**](./PRODUCTION.md) - Полное руководство по деплойменту
- ⚡ [**QUICKSTART.md**](./QUICKSTART.md) - Краткая справка

## Следующие шаги
1. ✅ Реализовать базовый WebSocket сервер и клиент
2. ✅ Добавить HTTP proxy функционал
3. ✅ Протестировать базовую работу
4. 🔄 Добавить обработку ошибок и переподключение (уже частично реализовано)
5. 🔜 Добавить HTTPS/WSS поддержку
6. 🔜 Улучшить логирование и мониторинг
