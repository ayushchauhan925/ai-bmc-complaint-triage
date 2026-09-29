const express = require('express');
const authRoutes = require('./auth.routes');
const complaintRoutes = require('./complaint.routes');
const adminRoutes = require('./admin.routes');
const officerRoutes = require('./officer.routes');
const incidentRoutes = require('./incident.routes');
const notificationRoutes = require('./notification.routes');
const publicRoutes = require('./public.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/complaints', complaintRoutes);
router.use('/admin', adminRoutes);
router.use('/officer', officerRoutes);
router.use('/incidents', incidentRoutes);
router.use('/notifications', notificationRoutes);
router.use('/public', publicRoutes);

router.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'API is healthy.' });
});

module.exports = router;
