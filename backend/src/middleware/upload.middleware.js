const multer = require('multer');
const AppError = require('../utils/AppError');

// Never trust the client-supplied filename/extension; only these server-observed MIME
// types are accepted (rule: do not trust file extensions).
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// Memory storage: files are held as a Buffer on req.file(s)[].buffer and streamed straight
// to Cloudinary (see services/upload/cloudinary.service.js) - nothing touches local disk,
// so this works unchanged on a read-only/ephemeral filesystem (e.g. Vercel).
const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIMES.has(file.mimetype)) {
    return cb(new AppError('Only JPEG, PNG or WEBP images are allowed.', 400));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 5 },
});

module.exports = { upload };
