# 🎯 Production Quick Start

## 🚀 САМЫЙ БЫСТРЫЙ СПОСОБ (PM2)

### На рабочем сервере:
```bash
# 1. Подготовка
git clone <your-repo> && cd websocket-tunnel
npm install pm2 -g
npm install --production

# 2. Конфигурация  
echo "PORT=3000
WS_PORT=3001" > .env

# 3. Автодеплой
./deploy.sh server

# ✅ ГОТОВО! Сервер запущен в фоне
```

### На вашем ПК:
```bash
# 1. Конфигурация клиента
echo "SERVER_WS_URL=ws://YOUR-SERVER-IP:3001  
LOCAL_TARGET=http://localhost:8080
CLIENT_ID=my-pc-client" > .env

# 2. Автодеплой
./deploy.sh client

# ✅ ГОТОВО! Клиент подключен
```

## 📊 Мониторинг

```bash
# Просмотр статуса
pm2 list

# Логи в реальном времени  
pm2 logs

# Мониторинг производительности
pm2 monit

# Проверка здоровья системы
./health-check.sh

# Проверка с автоперезапуском
./health-check.sh --restart
```

## 🔧 Управление

```bash
# Перезапуск всех сервисов
pm2 restart all

# Остановка
pm2 stop all

# Полная очистка
pm2 delete all
```

## 🌐 Проверка работы

```bash
# Статус системы
curl http://YOUR-SERVER:3000/health

# Подключенные клиенты
curl http://YOUR-SERVER:3000/status

# Тестовый запрос через туннель
curl http://YOUR-SERVER:3000/api/test
```

## 🔥 Альтернативные способы

1. **Docker**: См. `PRODUCTION.md` → Docker раздел
2. **systemd**: См. `PRODUCTION.md` → systemd раздел  
3. **nohup**: См. `PRODUCTION.md` → nohup раздел

## ⚡ Автоматизация

### Автозапуск PM2 при перезагрузке:
```bash
pm2 startup
pm2 save
```

### Автоматическая проверка здоровья (crontab):
```bash
# Добавить в crontab (каждые 5 минут)
*/5 * * * * /path/to/websocket-tunnel/health-check.sh --restart >> /var/log/tunnel-health.log 2>&1
```

### Автообновление из Git:
```bash
#!/bin/bash
# auto-update.sh
cd /path/to/websocket-tunnel
git pull origin main
npm install --production
npm run build
pm2 restart all
```

## 🔒 Безопасность

### Файрвол (UFW):
```bash
sudo ufw allow 22    # SSH
sudo ufw allow 3000  # HTTP API
sudo ufw allow 3001  # WebSocket
sudo ufw enable
```

### Nginx прокси (опционально):
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /ws {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 🆘 Troubleshooting

### Если сервер не запускается:
```bash
# Проверка логов
pm2 logs websocket-tunnel

# Проверка портов
lsof -i :3000
lsof -i :3001

# Ручной запуск для отладки
npm run dev:server
```

### Если клиент не подключается:
```bash
# Проверка логов клиента
pm2 logs tunnel-client

# Проверка подключения к серверу
telnet YOUR-SERVER-IP 3001

# Проверка .env конфигурации
cat .env
```

### Если запросы не проходят:
```bash
# Проверка локального приложения
curl http://localhost:8080/health

# Проверка статуса туннеля
curl http://YOUR-SERVER:3000/status

# Трассировка запроса
curl -v http://YOUR-SERVER:3000/api/test
```

## 🎉 Готовые команды

```bash
# Полная переустановка сервера
pm2 delete websocket-tunnel && ./deploy.sh server

# Полная переустановка клиента  
pm2 delete tunnel-client && ./deploy.sh client

# Бэкап логов
tar -czf logs-backup-$(date +%Y%m%d).tar.gz logs/

# Проверка производительности
ab -n 100 -c 10 http://YOUR-SERVER:3000/api/test
```

**🚀 Ваш WebSocket туннель готов к продакшену!**

---
Подробная документация: [PRODUCTION.md](./PRODUCTION.md)
