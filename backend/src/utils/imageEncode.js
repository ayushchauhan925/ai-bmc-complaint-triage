const fs = require('fs');
const path = require('path');
const env = require('../config/env');

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

// Convert a locally stored upload (referenced by its public "/uploads/xxx" URL) into a
// base64 data URI, since the OpenAI Vision API needs either a public URL or inline data
// and these uploads are not publicly reachable in a hackathon/dev environment.
function imageUrlToDataUri(publicUrl) {
  const filename = path.basename(publicUrl);
  const filePath = path.join(__dirname, '..', '..', env.uploadDir, filename);
  if (!fs.existsSync(filePath)) return null;

  const ext = path.extname(filename).toLowerCase();
  const mime = MIME_BY_EXT[ext] || 'image/jpeg';
  const buffer = fs.readFileSync(filePath);
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

module.exports = { imageUrlToDataUri };
