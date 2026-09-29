const { getCloudinary } = require('../../config/cloudinary');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

/**
 * Uploads an in-memory image buffer (from multer's memoryStorage - see
 * middleware/upload.middleware.js) to Cloudinary and returns its public HTTPS URL.
 *
 * Switching from local disk to Cloudinary does two things at once: it makes uploads work
 * on read-only/ephemeral filesystems (e.g. Vercel serverless functions), and it means
 * complaint photos are already at a public URL, so the OpenAI vision calls in
 * complaintAnalysis.service.js / imageVerification.service.js can pass that URL straight
 * through instead of re-reading the file and base64-encoding it (see the removed
 * utils/imageEncode.js - that workaround only existed because local dev uploads weren't
 * publicly reachable).
 */
function uploadBuffer(buffer, { folder }) {
  const cloudinary = getCloudinary();
  if (!cloudinary) {
    throw new AppError(
      'Image storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.',
      500
    );
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) {
          logger.error('Cloudinary upload failed.', { error: error.message, folder });
          return reject(new AppError('Image upload failed. Please try again.', 502));
        }
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

async function uploadComplaintImage(buffer, subfolder) {
  const result = await uploadBuffer(buffer, { folder: `civic-connect/${subfolder}` });
  return result.secure_url;
}

module.exports = { uploadBuffer, uploadComplaintImage };
