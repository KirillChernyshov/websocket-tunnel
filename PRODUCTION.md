# 🚀 Production Deployment Guide

## 📋 Общая схема развертывания

```
[Внешний сервер] → HTTP → [Рабочий сервер] → WebSocket → [Ваш ПК] → HTTP → [Локальное приложение]
```

## 🛠 Способ 1: PM2 (Рекомендуемый)

### Установка PM2 глобально:
```bash
npm install pm2 -g
```

### На рабочем сервере:

```bash
# 1. Клонирование и настройка
git clone <your-repo> websocket-tunnel
cd websocket-tunnel
npm install --production

# 2. Создание .env файла
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000
WS_PORT=3001
EOF

# 3. Сборка проекта
npm run build

# 4. Создание директории логов
mkdir -p logs

# 5. Запуск сервера через PM2
npm run deploy:server

# 6. Проверка статуса
pm2 status
pm2 logs websocket-tunnel
```

### На вашем ПК:

```bash
# 1. Настройка клиента
cat > .env << 'EOF'
NODE_ENV=production
SERVER_WS_URL=ws://your-work-server.com:3001
LOCAL_TARGET=http://localhost:8080
CLIENT_ID=my-pc-client
CLIENT_NAME=My Production PC
EOF

# 2. Запуск клиента через PM2
npm run deploy:client

# 3. Мониторинг
pm2 logs tunnel-client
pm2 monit
```

### Управление PM2:
```bash
# Просмотр всех процессов
pm2 list

# Логи в реальном времени
pm2 logs

# Мониторинг производительности
pm2 monit

# Перезапуск
pm2 restart all

# Остановка
pm2 stop all

# Полное удаление процессов
pm2 delete all

# Автозапуск при перезагрузке системы
pm2 startup
pm2 save
```

## 🐳 Способ 2: Docker

### Создание Dockerfile для сервера:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Копирование package.json
COPY package*.json ./

# Установка зависимостей
RUN npm ci --only=production

# Копирование исходного кода  
COPY . .

# Сборка TypeScript
RUN npm run build

# Создание пользователя без root
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Открытие портов
EXPOSE 3000 3001

# Запуск
CMD ["npm", "run", "start:server"]
```

### Docker Compose:
```yaml
version: '3.8'

services:
  tunnel-server:
    build: .
    ports:
      - "3000:3000"
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - WS_PORT=3001
    restart: unless-stopped
    volumes:
      - ./logs:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  tunnel-client:
    build: .
    environment:
      - NODE_ENV=production
      - SERVER_WS_URL=ws://tunnel-server:3001
      - LOCAL_TARGET=http://host.docker.internal:8080
      - CLIENT_ID=docker-client
    restart: unless-stopped
    depends_on:
      - tunnel-server
    command: ["npm", "run", "start:client"]
```

### Запуск через Docker:
```bash
# Сборка и запуск
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down
```

## ⚙️ Способ 3: systemd (Linux)

### Создание сервиса для сервера:
```bash
sudo tee /etc/systemd/system/websocket-tunnel-server.service > /dev/null << 'EOF'
[Unit]
Description=WebSocket Tunnel Server
After=network.target

[Service]
Type=simple
User=deploy
WorkingDirectory=/opt/websocket-tunnel
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=WS_PORT=3001
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=tunnel-server

[Install]
WantedBy=multi-user.target
EOF
```

### Создание сервиса для клиента:
```bash
sudo tee /etc/systemd/system/websocket-tunnel-client.service > /dev/null << 'EOF'
[Unit]
Description=WebSocket Tunnel Client
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/home/$USER/websocket-tunnel
Environment=NODE_ENV=production
Environment=SERVER_WS_URL=ws://your-server.com:3001
Environment=LOCAL_TARGET=http://localhost:8080
Environment=CLIENT_ID=systemd-client
ExecStart=/usr/bin/node dist/client/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=tunnel-client

[Install]
WantedBy=multi-user.target
EOF
```

### Управление systemd сервисами:
```bash
# Перезагрузка конфигурации
sudo systemctl daemon-reload

# Запуск сервисов
sudo systemctl start websocket-tunnel-server
sudo systemctl start websocket-tunnel-client

# Автозапуск при загрузке
sudo systemctl enable websocket-tunnel-server
sudo systemctl enable websocket-tunnel-client

# Статус
sudo systemctl status websocket-tunnel-server
sudo systemctl status websocket-tunnel-client

# Логи
sudo journalctl -u websocket-tunnel-server -f
sudo journalctl -u websocket-tunnel-client -f

# Остановка
sudo systemctl stop websocket-tunnel-server
sudo systemctl stop websocket-tunnel-client
```

## 🔧 Способ 4: nohup (Простейший)

### На рабочем сервере:
```bash
# Запуск сервера в фоне
nohup npm run start:server > logs/server.log 2>&1 &

# Сохранение PID
echo $! > server.pid
```

### На вашем ПК:
```bash
# Запуск клиента в фоне  
nohup npm run start:client > logs/client.log 2>&1 &

# Сохранение PID
echo $! > client.pid
```

### Управление nohup процессами:
```bash
# Просмотр логов
tail -f logs/server.log
tail -f logs/client.log

# Остановка по PID
kill $(cat server.pid)
kill $(cat client.pid)

# Поиск процессов
ps aux | grep node
```

## 🔒 Безопасность в продакшене

### 1. Использование HTTPS/WSS:
```javascript
// В коде сервера добавить HTTPS
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('/path/to/private-key.pem'),
  cert: fs.readFileSync('/path/to/certificate.pem')
};

const server = https.createServer(options, app);
```

### 2. Настройка Nginx как обратного прокси:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

### 3. Файрвол (UFW):
```bash
# Открыть необходимые порты
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS
sudo ufw allow 3000  # Tunnel HTTP
sudo ufw allow 3001  # Tunnel WebSocket
sudo ufw enable
```

## 📊 Мониторинг

### 1. Использование PM2 мониторинга:
```bash
# Веб-интерфейс мониторинга
pm2 web

# Keymetrics (платный сервис)
pm2 plus
```

### 2. Простой health check скрипт:
```bash
#!/bin/bash
# health-check.sh

HEALTH_URL="http://localhost:3000/health"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_URL)

if [ $RESPONSE -eq 200 ]; then
    echo "✅ Tunnel server is healthy"
else
    echo "❌ Tunnel server is unhealthy (HTTP $RESPONSE)"
    # Можно добавить перезапуск или уведомление
fi
```

### 3. Автоматические уведомления:
```bash
# Добавить в crontab для проверки каждые 5 минут
*/5 * * * * /path/to/health-check.sh
```

## 🚀 Быстрый деплой (Рекомендуемый)

### На рабочем сервере:
```bash
# Установить PM2 глобально
npm install pm2 -g

# Клонировать и настроить
git clone <repo> websocket-tunnel && cd websocket-tunnel
npm install --production
echo "PORT=3000\nWS_PORT=3001" > .env
npm run build
mkdir -p logs

# Запустить сервер
npm run deploy:server

# Проверить статус
pm2 list
curl http://localhost:3000/health
```

### На вашем ПК:
```bash
# Настроить клиент
echo "SERVER_WS_URL=ws://your-server.com:3001\nLOCAL_TARGET=http://localhost:8080\nCLIENT_ID=my-pc" > .env
npm run build

# Запустить клиент  
npm run deploy:client

# Проверить подключение
pm2 logs tunnel-client
```

Готово! 🎉 Ваш туннель работает в фоновом режиме с автоперезапуском и логированием.
