#!/bin/bash

# 🔧 Quick Fix Script for TypeScript Issues
echo "🔧 Исправляем проблемы с TypeScript..."

# Устанавливаем зависимости
echo "📦 Переустанавливаем зависимости..."
npm install

# Очищаем dist директорию
echo "🧹 Очищаем старую сборку..."
rm -rf dist

# Пересобираем проект
echo "🔨 Пересобираем проект..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Проект успешно собран!"
else
    echo "❌ Ошибка при сборке"
    exit 1
fi
