#!/bin/bash

# 🏥 Health Check Script for WebSocket Tunnel
# Использование: ./health-check.sh [--notify] [--restart]

set -e

COLOR_GREEN='\033[0;32m'
COLOR_BLUE='\033[0;34m' 
COLOR_RED='\033[0;31m'
COLOR_YELLOW='\033[1;33m'
COLOR_NC='\033[0m'

HEALTH_URL="http://localhost:3000/health"
STATUS_URL="http://localhost:3000/status"
NOTIFY=false
AUTO_RESTART=false

# Обработка аргументов
while [[ $# -gt 0 ]]; do
    case $1 in
        --notify)
            NOTIFY=true
            shift
            ;;
        --restart)
            AUTO_RESTART=true
            shift
            ;;
        *)
            echo "Использование: $0 [--notify] [--restart]"
            echo "  --notify    Отправить уведомления при проблемах"
            echo "  --restart   Автоматически перезапустить при сбоях"
            exit 1
            ;;
    esac
done

log() {
    echo -e "${COLOR_BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${COLOR_NC} $1"
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

notify() {
    if [ "$NOTIFY" = true ]; then
        # Можно добавить отправку email, Slack, Telegram и т.д.
        echo "📧 Уведомление: $1"
        # osascript -e "display notification \"$1\" with title \"Tunnel Health Check\""
    fi
}

restart_service() {
    if [ "$AUTO_RESTART" = true ]; then
        warning "🔄 Перезапускаю сервисы..."
        pm2 restart all
        sleep 5
        return 0
    fi
    return 1
}

# Проверка основного сервера
check_server() {
    log "🔍 Проверяю основной сервер..."
    
    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "$HEALTH_URL" 2>/dev/null || echo "000")
    
    if [ "$http_code" = "200" ]; then
        success "✅ HTTP сервер работает (порт 3000)"
        return 0
    else
        error "❌ HTTP сервер недоступен (код: $http_code)"
        notify "Tunnel HTTP Server Down - Code: $http_code"
        return 1
    fi
}

# Проверка WebSocket сервера
check_websocket() {
    log "🔍 Проверяю WebSocket сервер..."
    
    # Простая проверка порта
    if nc -z localhost 3001 2>/dev/null; then
        success "✅ WebSocket сервер слушает (порт 3001)"
        return 0
    else
        error "❌ WebSocket сервер недоступен (порт 3001)"
        notify "Tunnel WebSocket Server Down"
        return 1
    fi
}

# Проверка подключенных клиентов
check_clients() {
    log "🔍 Проверяю подключенных клиентов..."
    
    local response
    response=$(curl -s --connect-timeout 10 "$STATUS_URL" 2>/dev/null || echo "{}")
    
    local client_count
    client_count=$(echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('connectedClients', 0))
except:
    print(0)
" 2>/dev/null || echo "0")
    
    if [ "$client_count" -gt 0 ]; then
        success "✅ Подключено клиентов: $client_count"
        return 0
    else
        warning "⚠️  Нет подключенных клиентов"
        notify "No clients connected to tunnel"
        return 1
    fi
}

# Проверка процессов PM2
check_pm2() {
    log "🔍 Проверяю процессы PM2..."
    
    if ! command -v pm2 &> /dev/null; then
        warning "⚠️  PM2 не найден"
        return 1
    fi
    
    local pm2_status
    pm2_status=$(pm2 jlist 2>/dev/null || echo "[]")
    
    local running_count
    running_count=$(echo "$pm2_status" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    count = sum(1 for p in data if p.get('pm2_env', {}).get('status') == 'online')
    print(count)
except:
    print(0)
" 2>/dev/null || echo "0")
    
    if [ "$running_count" -gt 0 ]; then
        success "✅ PM2 процессов запущено: $running_count"
        return 0
    else
        error "❌ Нет запущенных PM2 процессов"
        notify "No PM2 processes running"
        return 1
    fi
}

# Проверка использования памяти
check_memory() {
    log "🔍 Проверяю использование памяти..."
    
    local memory_usage
    memory_usage=$(free | grep '^Mem:' | awk '{printf "%.1f", ($3/$2) * 100.0}' 2>/dev/null || echo "0")
    
    local memory_threshold=90
    
    if (( $(echo "$memory_usage > $memory_threshold" | bc -l) )); then
        warning "⚠️  Высокое использование памяти: ${memory_usage}%"
        notify "High memory usage: ${memory_usage}%"
        return 1
    else
        success "✅ Использование памяти: ${memory_usage}%"
        return 0
    fi
}

# Проверка дискового пространства
check_disk() {
    log "🔍 Проверяю дисковое пространство..."
    
    local disk_usage
    disk_usage=$(df . | awk 'NR==2 {print $(NF-1)}' | sed 's/%//')
    
    local disk_threshold=85
    
    if [ "$disk_usage" -gt $disk_threshold ]; then
        warning "⚠️  Мало места на диске: ${disk_usage}%"
        notify "Low disk space: ${disk_usage}%"
        return 1
    else
        success "✅ Свободно места на диске: $((100-disk_usage))%"
        return 0
    fi
}

# Основная проверка
main() {
    log "🏥 Запуск проверки здоровья WebSocket Tunnel..."
    echo "=================================================="
    
    local issues=0
    local critical_issues=0
    
    # Критичные проверки
    if ! check_server; then
        ((critical_issues++))
        ((issues++))
    fi
    
    if ! check_websocket; then
        ((critical_issues++))
        ((issues++))
    fi
    
    if ! check_pm2; then
        ((critical_issues++))
        ((issues++))
    fi
    
    # Некритичные проверки
    if ! check_clients; then
        ((issues++))
    fi
    
    if ! check_memory; then
        ((issues++))
    fi
    
    if ! check_disk; then
        ((issues++))
    fi
    
    echo "=================================================="
    
    if [ $critical_issues -gt 0 ]; then
        error "❌ Обнаружены критичные проблемы: $critical_issues"
        
        if restart_service; then
            log "🔄 Попытка автоматического восстановления..."
            sleep 10
            
            # Повторная проверка после перезапуска
            if check_server && check_websocket && check_pm2; then
                success "✅ Сервисы восстановлены после перезапуска"
                issues=0
            else
                error "❌ Не удалось восстановить сервисы"
                notify "Failed to restart tunnel services"
            fi
        else
            log "💡 Для автоматического перезапуска используйте: $0 --restart"
        fi
        
    elif [ $issues -gt 0 ]; then
        warning "⚠️  Обнаружены некритичные проблемы: $issues"
        
    else
        success "🎉 Все проверки пройдены успешно!"
    fi
    
    log "📊 Итого проблем: $issues (критичных: $critical_issues)"
    
    return $issues
}

# Запуск основной функции
main "$@"
