#!/bin/bash

# 🚀 Quick Production Deploy Script
# Использование: ./deploy.sh [server|client]

set -e  # Выйти при ошибке

COLOR_GREEN='\033[0;32m'
COLOR_BLUE='\033[0;34m' 
COLOR_RED='\033[0;31m'
COLOR_YELLOW='\033[1;33m'
COLOR_NC='\033[0m' # No Color

log() {
    echo -e "${COLOR_BLUE}[INFO]${COLOR_NC} $1"
}

success() {
    echo -e "${COLOR_GREEN}[SUCCESS]${COLOR_NC} $1"
}

error() {
    echo -e "${COLOR_RED}[ERROR]${COLOR_NC} $1"
}

warning() {
    echo -e "${COLOR_YELLOW}[WARNING]${COLOR_NC} $1"
}

# Проверка аргументов
if [ $# -eq 0 ]; then
    error "Использование: $0 [server|client]"
    echo "  server - деплой сервера (для рабочей машины)"
    echo "  client - деплой клиента (для вашего ПК)"
    exit 1
fi

MODE=$1

# Проверка Node.js
if ! command -v node &> /dev/null; then
    error "Node.js не найден. Установите Node.js версии 16+"
    exit 1
fi

# Проверка PM2
if ! command -v pm2 &> /dev/null; then
    warning "PM2 не найден. Устанавливаю..."
    npm install pm2 -g
fi

log "🚀 Начинаю деплой в режиме: $MODE"

# Проверка .env файла
if [ ! -f .env ]; then
    warning ".env файл не найден. Создаю из примера..."
    cp .env.example .env
    warning "⚠️  Не забудьте отредактировать .env файл!"
fi

# Установка зависимостей
log "📦 Устанавливаю зависимости..."
npm install --production

# Сборка проекта
log "🔨 Собираю проект..."
npm run build

# Создание директории логов
log "📁 Создаю директорию логов..."
mkdir -p logs

# Деплой в зависимости от режима
if [ "$MODE" = "server" ]; then
    log "🖥️  Разворачиваю сервер..."
    
    # Проверка портов
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        warning "Порт 3000 уже используется. Остановка существующих процессов..."
        pm2 stop websocket-tunnel 2>/dev/null || true
    fi
    
    if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
        warning "Порт 3001 уже используется"
    fi
    
    # Запуск сервера
    npm run pm2:server
    
    # Ожидание запуска
    sleep 3
    
    # Проверка здоровья
    log "🔍 Проверяю статус сервера..."
    if curl -sf http://localhost:3000/health > /dev/null; then
        success "✅ Сервер успешно запущен и работает!"
        log "📊 Статус: http://localhost:3000/health"
        log "📈 Мониторинг клиентов: http://localhost:3000/status"
    else
        error "❌ Сервер не отвечает на health check"
        pm2 logs websocket-tunnel --lines 20
        exit 1
    fi
    
elif [ "$MODE" = "client" ]; then
    log "💻 Разворачиваю клиент..."
    
    # Проверка конфигурации
    if ! grep -q "SERVER_WS_URL" .env; then
        error "❌ SERVER_WS_URL не настроен в .env файле"
        exit 1
    fi
    
    if ! grep -q "LOCAL_TARGET" .env; then
        error "❌ LOCAL_TARGET не настроен в .env файле"
        exit 1
    fi
    
    # Остановка существующего клиента
    pm2 stop tunnel-client 2>/dev/null || true
    
    # Запуск клиента
    npm run pm2:client
    
    # Ожидание подключения
    sleep 5
    
    success "✅ Клиент запущен!"
    log "📊 Проверьте логи: pm2 logs tunnel-client"
    
else
    error "Неизвестный режим: $MODE"
    exit 1
fi

# Показать статус PM2
log "📋 Текущий статус PM2:"
pm2 list

success "🎉 Деплой завершен успешно!"
log "💡 Полезные команды:"
log "   pm2 logs          - Просмотр логов"
log "   pm2 monit         - Мониторинг"
log "   pm2 restart all   - Перезапуск"
log "   pm2 stop all      - Остановка"

if [ "$MODE" = "server" ]; then
    log ""
    log "🔗 Для подключения клиента используйте:"
    log "   SERVER_WS_URL=ws://$(hostname -I | awk '{print $1}'):3001"
fi
