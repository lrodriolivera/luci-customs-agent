# LUCI Mobile - Agente Aduanero Inteligente

Aplicacion movil para LUCI Customs Agent desarrollada con React Native y Expo.

## Caracteristicas

- **Dashboard**: Vista general con KPIs y alertas
- **Expedientes**: Lista y detalle de expedientes aduaneros
- **Escaneo de Documentos**: Captura con camara y OCR
- **Chat con LUCI**: Asistente IA para consultas aduaneras
- **Notificaciones Push**: Alertas en tiempo real
- **Perfil y Configuracion**: Gestion de cuenta y preferencias

## Requisitos

- Node.js 18+
- npm o yarn
- Expo CLI (`npm install -g expo-cli`)
- Dispositivo fisico o emulador (iOS Simulator / Android Emulator)

## Instalacion

```bash
# Navegar al directorio mobile
cd mobile

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm start
```

## Ejecucion

```bash
# Iniciar en modo desarrollo
npm start

# Iniciar en Android
npm run android

# Iniciar en iOS
npm run ios

# Iniciar en web (para pruebas)
npm run web
```

## Estructura del Proyecto

```
mobile/
├── App.js                    # Entrada principal y navegacion
├── app.json                  # Configuracion de Expo
├── package.json              # Dependencias
├── babel.config.js           # Configuracion de Babel
├── assets/                   # Iconos e imagenes
└── src/
    ├── context/
    │   └── AuthContext.js    # Contexto de autenticacion
    ├── screens/
    │   ├── LoginScreen.js    # Pantalla de login
    │   ├── DashboardScreen.js # Dashboard principal
    │   ├── ExpeditionsScreen.js # Lista de expedientes
    │   ├── ExpeditionDetailScreen.js # Detalle de expediente
    │   ├── ScannerScreen.js  # Escaneo de documentos
    │   ├── ChatScreen.js     # Chat con LUCI
    │   ├── NotificationsScreen.js # Notificaciones
    │   └── ProfileScreen.js  # Perfil de usuario
    ├── services/
    │   ├── api.js           # Servicio de API
    │   └── notifications.js  # Servicio de push notifications
    ├── components/          # Componentes reutilizables
    ├── hooks/               # Custom hooks
    └── utils/               # Utilidades
```

## Configuracion del Backend

Editar la URL del API en `src/services/api.js`:

```javascript
const API_BASE_URL = 'http://TU_IP:5001';
```

Para desarrollo local, usar la IP de tu maquina en la red local.

## Build para Produccion

### Android (APK/AAB)

```bash
# Generar APK para pruebas
eas build -p android --profile preview

# Generar AAB para Play Store
eas build -p android --profile production
```

### iOS (IPA)

```bash
# Build para TestFlight
eas build -p ios --profile production

# Enviar a App Store
eas submit -p ios
```

## Notas

- La aplicacion requiere un dispositivo fisico para Push Notifications y camara
- Para iOS, necesitas una cuenta de Apple Developer
- El escaneo de documentos usa la camara del dispositivo + OCR del backend

## Autor

Stock Logistic - LUCI Customs Agent
