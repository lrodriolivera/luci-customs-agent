const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Asegurar que existe el directorio de uploads
const uploadDir = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Subdirectorios por tipo
const subdirs = ['documents', 'temp', 'processed'];
subdirs.forEach(dir => {
  const subPath = path.join(uploadDir, dir);
  if (!fs.existsSync(subPath)) {
    fs.mkdirSync(subPath, { recursive: true });
  }
});

/**
 * Configuracion de almacenamiento
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Guardar en subdirectorio de documentos
    cb(null, path.join(uploadDir, 'documents'));
  },
  filename: (req, file, cb) => {
    // Generar nombre unico preservando extension
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

/**
 * Filtro de tipos de archivo permitidos
 */
const fileFilter = (req, file, cb) => {
  // Tipos MIME permitidos para documentos de comercio exterior
  const allowedMimes = [
    // PDFs
    'application/pdf',
    // Imagenes
    'image/jpeg',
    'image/png',
    'image/tiff',
    'image/webp',
    // Documentos Office
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    // Otros
    'text/plain',
    'text/csv',
    'application/xml',
    'text/xml'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`), false);
  }
};

/**
 * Configuracion principal de multer
 */
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 52428800, // 50MB default
    files: 10 // Maximo 10 archivos por request
  }
});

/**
 * Middleware para manejar errores de multer
 */
const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'El archivo excede el tamano maximo permitido (50MB)'
      });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: 'Maximo 10 archivos por subida'
      });
    }
    return res.status(400).json({
      success: false,
      error: `Error de subida: ${err.message}`
    });
  }

  if (err) {
    return res.status(400).json({
      success: false,
      error: err.message
    });
  }

  next();
};

/**
 * Utilidades para manejo de archivos
 */
const fileUtils = {
  // Obtener ruta completa de un archivo
  getFilePath: (filename) => {
    return path.join(uploadDir, 'documents', filename);
  },

  // Verificar si archivo existe
  fileExists: (filename) => {
    const filePath = path.join(uploadDir, 'documents', filename);
    return fs.existsSync(filePath);
  },

  // Eliminar archivo
  deleteFile: (filename) => {
    const filePath = path.join(uploadDir, 'documents', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  },

  // Obtener info del archivo
  getFileInfo: (filename) => {
    const filePath = path.join(uploadDir, 'documents', filename);
    if (!fs.existsSync(filePath)) return null;

    const stats = fs.statSync(filePath);
    return {
      path: filePath,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime
    };
  },

  // Mover archivo a procesados
  moveToProcessed: (filename) => {
    const srcPath = path.join(uploadDir, 'documents', filename);
    const destPath = path.join(uploadDir, 'processed', filename);

    if (fs.existsSync(srcPath)) {
      fs.renameSync(srcPath, destPath);
      return destPath;
    }
    return null;
  },

  // Limpiar archivos temporales antiguos (mas de 24h)
  cleanTempFiles: () => {
    const tempDir = path.join(uploadDir, 'temp');
    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 horas

    files.forEach(file => {
      const filePath = path.join(tempDir, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
      }
    });
  }
};

module.exports = {
  upload,
  handleUploadError,
  fileUtils,
  uploadDir
};
