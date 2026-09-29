const { pool } = require('../config/db');
const incidentModel = require('../models/incident.model');
const complaintModel = require('../models/complaint.model');
const incidentEventModel = require('../models/incidentEvent.model');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

const list = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, status, department_id } = req.query;
  const filters = { status };
  if (department_id) filters.department_id = Number(department_id);
  const result = await incidentModel.list(filters, { page: Number(page), limit: Number(limit) });
  res.status(200).json({ success: true, data: result });
});

const getOne = asyncHandler(async (req, res) => {
  const incident = await incidentModel.findById(req.params.id);
  if (!incident) {
    throw new AppError('Incident not found.', 404);
  }
  const [complaints, timeline] = await Promise.all([
    incidentModel.getLinkedComplaints(req.params.id),
    incidentEventModel.listForIncident(req.params.id),
  ]);
  const complaintsWithImages = await Promise.all(
    complaints.map(async (c) => ({ ...c, images: await complaintModel.getImages(c.id) }))
  );
  res.status(200).json({ success: true, data: { incident, complaints: complaintsWithImages, timeline } });
});

const create = asyncHandler(async (req, res) => {
  const { title, category, latitude, longitude, department_id } = req.body;
  const conn = await pool.getConnection();
  let created;
  try {
    await conn.beginTransaction();
    created = await incidentModel.create(conn, {
      title,
      category,
      latitude,
      longitude,
      departmentId: department_id || null,
      priorityScore: 0,
      priorityLevel: 'LOW',
    });
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  const incident = await incidentModel.findById(created.id);
  res.status(201).json({ success: true, data: { incident } });
});

const update = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (status) {
    await incidentModel.updateStatus(req.params.id, status, req.user.id);
  }
  const incident = await incidentModel.findById(req.params.id);
  res.status(200).json({ success: true, data: { incident } });
});

const addComplaint = asyncHandler(async (req, res) => {
  const { complaint_id } = req.body;
  const complaint = await complaintModel.findById(complaint_id);
  if (!complaint) {
    throw new AppError('Complaint not found.', 404);
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await incidentModel.linkComplaint(conn, req.params.id, complaint_id, req.user.id);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  const incident = await incidentModel.findById(req.params.id);
  res.status(200).json({ success: true, data: { incident } });
});

const removeComplaint = asyncHandler(async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await incidentModel.unlinkComplaint(conn, req.params.id, req.params.complaintId, req.user.id);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  const incident = await incidentModel.findById(req.params.id);
  res.status(200).json({ success: true, data: { incident } });
});

// Section 5: merge one incident's complaints into another (e.g. two incidents that turned
// out to describe the same civic issue). The source incident is closed, not deleted, so its
// history/audit trail stays intact.
const merge = asyncHandler(async (req, res) => {
  const targetId = req.params.id;
  const { source_incident_id } = req.body;

  const [target, source] = await Promise.all([
    incidentModel.findById(targetId),
    incidentModel.findById(source_incident_id),
  ]);
  if (!target || !source) {
    throw new AppError('Both incidents must exist to merge.', 404);
  }
  if (Number(targetId) === Number(source_incident_id)) {
    throw new AppError('Cannot merge an incident into itself.', 400);
  }

  await incidentModel.mergeInto(targetId, source_incident_id, req.user.id);
  logger.info('Incidents merged.', { targetId, sourceId: source_incident_id, actorId: req.user.id });

  const incident = await incidentModel.findById(targetId);
  res.status(200).json({ success: true, data: { incident } });
});

module.exports = { list, getOne, create, update, addComplaint, removeComplaint, merge };
