const { pool } = require('../../config/db');
const complaintModel = require('../../models/complaint.model');
const AppError = require('../../utils/AppError');

async function createComplaint({ userId, description, latitude, longitude, address, imageFiles }) {
  const conn = await pool.getConnection();
  let complaintId;
  let complaintNumber;
  try {
    await conn.beginTransaction();

    const created = await complaintModel.create(conn, { userId, description, latitude, longitude, address });
    complaintId = created.id;
    complaintNumber = created.complaintNumber;

    for (const file of imageFiles || []) {
      const publicUrl = `/uploads/${file.filename}`;
      await complaintModel.addImage(conn, complaintId, publicUrl, 'ORIGINAL');
    }

    await complaintModel.addHistory(conn, complaintId, null, 'SUBMITTED', userId, 'Complaint submitted by citizen.');

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

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
