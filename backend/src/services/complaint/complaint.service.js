const { pool } = require('../../config/db');
const complaintModel = require('../../models/complaint.model');
const { uploadComplaintImage } = require('../upload/cloudinary.service');
const AppError = require('../../utils/AppError');
const imageIntelligence = require('../image/imageIntelligence.service');
const timelineService = require('./timeline.service');
const auditService = require('../audit/audit.service');

async function createComplaint({ userId, description, latitude, longitude, address, imageFiles }) {
  // Upload to Cloudinary before opening the transaction - no point holding a DB
  // transaction open across slow network calls to a third-party service.
  // Local image measurements (perceptual hash, sharpness) are best-effort: a failure never
  // blocks the upload.
  const images = await Promise.all(
    (imageFiles || []).map(async (file) => {
      const [url, measured] = await Promise.all([
        uploadComplaintImage(file.buffer, 'original'),
        imageIntelligence.analyzeBuffer(file.buffer),
      ]);
      return { url, metrics: measured.analysed ? measured : null };
    })
  );

  const conn = await pool.getConnection();
  let complaintId;
  let complaintNumber;
  try {
    await conn.beginTransaction();

    const created = await complaintModel.create(conn, { userId, description, latitude, longitude, address });
    complaintId = created.id;
    complaintNumber = created.complaintNumber;

    for (const image of images) {
      await complaintModel.addImage(conn, complaintId, image.url, 'ORIGINAL', image.metrics);
    }

    await complaintModel.addHistory(conn, complaintId, null, 'SUBMITTED', userId, 'Complaint submitted by citizen.');

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  await timelineService.recordEvent(complaintId, timelineService.EVENT_TYPES.CREATED, 'Complaint received', {
    details: { complaintNumber, photoCount: images.length },
    actorId: userId,
    visibility: 'PUBLIC',
  });
  await auditService.record({
    actor: { id: userId, role: 'CITIZEN' },
    action: 'COMPLAINT_CREATED',
    entityType: 'complaint',
    entityId: complaintId,
    next: { complaintNumber, photoCount: images.length },
  });

  return getComplaintDetail(complaintId);
}

async function getComplaintDetail(id) {
  const complaint = await complaintModel.findById(id);
  if (!complaint) {
    throw new AppError('Complaint not found.', 404);
  }
  const [images, history] = await Promise.all([
    complaintModel.getImages(id),
    complaintModel.getHistory(id),
  ]);
  return { ...complaint, images, history };
}

async function listComplaints(filters, pagination) {
  return complaintModel.list(filters, pagination);
}

function assertOwnerOrStaff(complaint, user) {
  if (user.role === 'CITIZEN' && complaint.user_id !== user.id) {
    throw new AppError('You do not have access to this complaint.', 403);
  }
}

module.exports = { createComplaint, getComplaintDetail, listComplaints, assertOwnerOrStaff };
