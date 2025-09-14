# WebSocket Tunnel Project 🚀

**Система туннелирования через WebSocket с элегантной JSON конфигурацией**

## 🎯 Что это?

WebSocket Tunnel позволяет получать доступ к локальным приложениям через удаленный сервер, обходя NAT и файерволы. 

**🗺️ Множественные мапинги** - один клиент может обслуживать множество приложений!  
**🎨 Красивая конфигурация** - JSON вместо гадких .env переменных!

## ✨ Основные возможности

- ✅ **Множественные клиенты** - каждый с постоянным адресом
- ✅ **Множественные мапинги** - один клиент → множество приложений  
- ✅ **Элегантная конфигурация** - JSON вместо парсинга строк
- ✅ **Утилиты управления** - команды для добавления/удаления мапингов
- ✅ **Production готовность** - PM2 интеграция и мониторинг
- ✅ **Автопереподключение** - устойчивость к сбоям сети

## 🗺️ Конфигурация мапингов

### Красивый JSON (mappings.json):
```json
{
  "client": {
    "id": "raider-pc-admin-2",
    "name": "Raider PC",
    "defaultTarget": "http://localhost:8000"
  },
  "mappings": [
    {
      "prefix": "app1",
      "target": "http://localhost:8000",
      "description": "Frontend Application",
      "enabled": true
    },
    {
      "prefix": "api",
      "target": "http://localhost:5000", 
      "description": "API Server",
      "enabled": true,
      "healthCheck": "/health"
    },
    {
      "prefix": "admin",
      "target": "http://localhost:9000",
      "description": "Admin Panel", 
      "enabled": true,
      "protected": true
    }
  ]
}
```

### Результирующие адреса:
```
http://your-server.com:3000/client/raider-pc-admin-2/app1/*  → http://localhost:8000
http://your-server.com:3000/client/raider-pc-admin-2/api/*   → http://localhost:5000
http://your-server.com:3000/client/raider-pc-admin-2/admin/* → http://localhost:9000
http://your-server.com:3000/client/raider-pc-admin-2/*       → http://localhost:8000 (fallback)
```

## 🚀 Быстрый старт

### 1. Установка зависимостей
```bash
# Исправить проблемы с TypeScript (если есть)
npm run fix:deps

# Или вручную
npm install
```

### 2. Запуск сервера (на рабочем сервере)
```bash
npm run build
./deploy.sh server
```

### 3. Запуск клиента (на домашнем ПК)
```bash
# Клиент автоматически создаст mappings.json при первом запуске
npm run build
./deploy.sh client
```

### 4. Управление мапингами
```bash
# Посмотреть текущие мапинги
npm run mappings list

# Добавить новый мапинг
npm run mappings add blog http://localhost:3030 "Blog Server"

# Выключить мапинг временно
npm run mappings disable admin

# Включить обратно
npm run mappings enable admin
```

### 5. Тестирование
```bash
# Запустить тестовые серверы (опционально)
npm run start:multi-servers

# Протестировать мапинги
npm run test:mappings
```

## 🛠️ Управление мапингами

### Основные команды:
```bash
npm run mappings list                              # Показать все мапинги
npm run mappings add <prefix> <target> <desc>      # Добавить мапинг
npm run mappings remove <prefix>                   # Удалить мапинг
npm run mappings enable <prefix>                   # Включить мапинг
npm run mappings disable <prefix>                  # Выключить мапинг
npm run mappings backup                            # Резервная копия
npm run mappings validate                          # Проверить JSON
```

### Примеры:
```bash
# Добавить блог
npm run mappings add blog http://localhost:3030 "Blog Application"

# Временно отключить админку
npm run mappings disable admin

# Удалить ненужный сервис
npm run mappings remove docs

# Посмотреть что получилось
npm run mappings list
```

## 📋 Доступные команды

### NPM скрипты:
```bash
npm run build                 # Собрать проект
npm run type-check           # Проверить типы TypeScript

# Утилиты:
npm run fix:deps             # Исправить зависимости
npm run start:multi-servers  # Запустить тестовые серверы
npm run test:mappings        # Протестировать мапинги
npm run mappings             # Управление мапингами
```

### Bash скрипты:
```bash
./fix-dependencies.sh       # Исправить проблемы с TypeScript
./start-multi-servers.sh    # Запустить множественные тестовые серверы
./test-mappings.sh         # Протестировать все мапинги
./deploy.sh server         # Деплой сервера
./deploy.sh client         # Деплой клиента
./manage-mappings.sh       # Управление мапингами (или npm run mappings)
```

## 🎯 Примеры использования

### Frontend + API разделение:
```bash
npm run mappings add frontend http://localhost:3000 "React App"
npm run mappings add api http://localhost:5000 "Backend API"
```

Результат:
- `http://server.com:3000/client/id/frontend/*` → React приложение
- `http://server.com:3000/client/id/api/*` → Backend API

### Микросервисная архитектура:
```bash
npm run mappings add auth http://localhost:3001 "Authentication Service"
npm run mappings add users http://localhost:3002 "User Service"  
npm run mappings add orders http://localhost:3003 "Order Service"
npm run mappings add admin http://localhost:9000 "Admin Panel"
```

### Development environments:
```bash
npm run mappings add dev http://localhost:3000 "Development Build"
npm run mappings add staging http://localhost:3001 "Staging Build"
npm run mappings disable staging  # Выключить пока не нужен
```

## 📊 Мониторинг и API

### Системные endpoints:
```bash
GET /health                  # Статус сервера
GET /status                  # Детальная информация
GET /clients                 # Список всех клиентов
GET /clients/{clientId}      # Информация о клиенте
```

### Health checks клиентов:
```bash
curl "http://46.174.49.245:3000/client/raider-pc-admin-2/health"
curl "http://46.174.49.245:3000/client/raider-pc-admin-2/app1/health"
curl "http://46.174.49.245:3000/client/raider-pc-admin-2/api/health"
```

## 🧪 Тестирование

### Автоматическое тестирование:
```bash
# Запустить тестовые серверы на портах 8000, 3000, 5000, 9000, 4000
npm run start:multi-servers

# Протестировать все мапинги
npm run test:mappings
```

### Ручное тестирование:
```bash
# Тестировать разные мапинги
curl "http://46.174.49.245:3000/client/raider-pc-admin-2/app1/api/info"
curl "http://46.174.49.245:3000/client/raider-pc-admin-2/api/health"
curl "http://46.174.49.245:3000/client/raider-pc-admin-2/admin/"

# POST запросы
curl -X POST "http://46.174.49.245:3000/client/raider-pc-admin-2/api/api/test" \
     -H "Content-Type: application/json" \
     -d '{"message":"test"}'
```

## 🔧 Устранение неисправностей

### Проблемы компиляции:
```bash
npm run fix:deps  # Исправить проблемы с TypeScript
```

### Проблемы конфигурации:
```bash
npm run mappings validate   # Проверить JSON
npm run mappings list       # Показать текущие мапинги
npm run mappings backup     # Создать резервную копию
```

### Проблемы подключения:
```bash
pm2 logs tunnel-client      # Проверить логи клиента
curl http://46.174.49.245:3000/health  # Проверить сервер
```

### Проблемы с мапингами:
```bash
npm run start:multi-servers # Запустить тестовые серверы
npm run test:mappings       # Протестировать все мапинги
```

## 📁 Структура проекта

```
websocket-tunnel/
├── src/
│   ├── client/index.ts          # Клиент с JSON конфигурацией
│   ├── server/                  # Серверная часть
│   └── shared/types.ts          # Общие типы
├── mappings.json                # 🎨 Конфигурация мапингов
├── .env                         # Простые настройки (порты, URL)
├── manage-mappings.sh           # 🛠️ Утилита управления
├── MAPPINGS.md                  # 📋 Гайд по конфигурации
└── README.md                    # 📖 Эта документация
```

## 💡 Конфигурация

### .env (только простые настройки):
```env
# Server Configuration
PORT=3000
WS_PORT=3001

# Client Configuration  
SERVER_WS_URL=ws://46.174.49.245:3001

# Connection settings
REQUEST_TIMEOUT=30000
HEARTBEAT_INTERVAL=30000
RECONNECT_INTERVAL=5000
```

### mappings.json (сложные структуры):
- Автоматически создается при первом запуске клиента
- Управляется через `npm run mappings` команды
- Поддерживает валидацию и резервное копирование
- Читается в реальном времени при изменениях

## 🎨 Преимущества JSON конфигурации

✅ **Читаемость** - Структурированный, понятный формат  
✅ **Валидация** - Автоматическая проверка синтаксиса  
✅ **Утилиты** - Команды для управления  
✅ **Резервные копии** - Автоматическое создание backup  
✅ **IDE поддержка** - Подсветка синтаксиса, автодополнение  
✅ **Гибкость** - Легко добавлять новые поля  

❌ **Vs .env парсинг** - Никаких гадких строк типа `MAPPING_1=prefix:target:description`!

---

**Проект готов к использованию!** 🎉  
**Множественные мапинги с красивой конфигурацией!** 🗺️🎨

Подробнее о конфигурации мапингов: [MAPPINGS.md](MAPPINGS.md)