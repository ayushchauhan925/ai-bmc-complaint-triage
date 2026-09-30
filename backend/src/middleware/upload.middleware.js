const multer = require('multer');
const AppError = require('../utils/AppError');
const { detectImageType } = require('../utils/imageFormat');

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

const MIME_BY_TYPE = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

// multer only sees the client-declared MIME type. This runs after it and checks the real
// file signature (magic bytes), so a renamed/forged non-image upload is rejected before it
// reaches image processing or third-party storage.
function verifyImageContent(req, res, next) {
  const files = [...(req.files || []), ...(req.file ? [req.file] : [])];
  for (const file of files) {
    const actual = detectImageType(file.buffer);
    if (!actual || MIME_BY_TYPE[actual] !== file.mimetype) {
      return next(new AppError('Uploaded file is not a valid JPEG, PNG or WEBP image.', 400));
    }
  }
  next();
}

module.exports = { upload, verifyImageContent };
