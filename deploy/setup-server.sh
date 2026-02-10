#!/bin/bash
# ==============================================================================
# Script de instalación del servidor LUCI Customs Agent
# Para: Ubuntu 22.04 LTS en AWS EC2
# ==============================================================================

set -e

echo "==========================================="
echo "  LUCI Customs Agent - Setup Server"
echo "==========================================="

# Actualizar sistema
echo -e "\n[1/7] Actualizando sistema..."
sudo apt-get update
sudo apt-get upgrade -y

# Instalar dependencias básicas
echo -e "\n[2/7] Instalando dependencias básicas..."
sudo apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    unzip \
    htop \
    nano

# Instalar Docker
echo -e "\n[3/7] Instalando Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    sudo usermod -aG docker ubuntu
    echo "Docker instalado"
else
    echo "Docker ya está instalado"
fi

# Instalar Node.js 20 LTS
echo -e "\n[4/7] Instalando Node.js 20 LTS..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    echo "Node.js instalado: $(node --version)"
else
    echo "Node.js ya está instalado: $(node --version)"
fi

# Instalar MongoDB 7.0
echo -e "\n[5/7] Instalando MongoDB 7.0..."
if ! command -v mongod &> /dev/null; then
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
    echo "deb [arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    sudo apt-get update
    sudo apt-get install -y mongodb-org
    sudo systemctl start mongod
    sudo systemctl enable mongod
    echo "MongoDB instalado"
else
    echo "MongoDB ya está instalado"
fi

# Instalar Nginx
echo -e "\n[6/7] Instalando Nginx..."
if ! command -v nginx &> /dev/null; then
    sudo apt-get install -y nginx
    sudo systemctl enable nginx
    echo "Nginx instalado"
else
    echo "Nginx ya está instalado"
fi

# Instalar Certbot para SSL
echo -e "\n[7/7] Instalando Certbot..."
if ! command -v certbot &> /dev/null; then
    sudo apt-get install -y certbot python3-certbot-nginx
    echo "Certbot instalado"
else
    echo "Certbot ya está instalado"
fi

# Crear directorios para la aplicación
echo -e "\n[+] Creando directorios..."
sudo mkdir -p /opt/luci-customs
sudo mkdir -p /opt/luci-customs/backend
sudo mkdir -p /opt/luci-customs/frontend
sudo mkdir -p /opt/luci-customs/uploads
sudo mkdir -p /opt/luci-customs/logs
sudo mkdir -p /opt/luci-customs/certs
sudo chown -R ubuntu:ubuntu /opt/luci-customs

# Instalar PM2 para gestión de procesos
echo -e "\n[+] Instalando PM2..."
sudo npm install -g pm2

# Mostrar estado
echo -e "\n==========================================="
echo "  Instalación completada"
echo "==========================================="
echo "Docker:   $(docker --version 2>/dev/null || echo 'N/A')"
echo "Node.js:  $(node --version 2>/dev/null || echo 'N/A')"
echo "npm:      $(npm --version 2>/dev/null || echo 'N/A')"
echo "MongoDB:  $(mongod --version 2>/dev/null | head -1 || echo 'N/A')"
echo "Nginx:    $(nginx -v 2>&1 || echo 'N/A')"
echo "PM2:      $(pm2 --version 2>/dev/null || echo 'N/A')"
echo "==========================================="
echo ""
echo "Directorio de la aplicación: /opt/luci-customs"
echo ""
echo "IMPORTANTE: Reinicia la sesión SSH para que Docker funcione sin sudo"
echo ""
