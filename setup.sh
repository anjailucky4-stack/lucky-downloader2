#!/data/data/com.termux/files/usr/bin/bash
# Lucky Downloader — Setup Script untuk Termux
# Jalankan: bash setup.sh

echo "🍀 Lucky Downloader Setup"
echo "========================="

# Install Node.js kalau belum ada
if ! command -v node &> /dev/null; then
  echo "📦 Install Node.js..."
  pkg install nodejs -y
fi

echo "✅ Node.js: $(node -v)"
echo "🚀 Menjalankan server..."
node server.js
