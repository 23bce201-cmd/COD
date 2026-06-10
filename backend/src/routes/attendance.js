import express from 'express';
import { requireRole } from '../middleware/scopeGuard.js';
import {
    // Employee
    checkIn,
    checkOut,
    addBreak,
    getMyAttendance,
    getMyLeaves,
    applyLeave,
    cancelLeave,
    submitCorrection,
    submitOnDuty,
    // Manager
    getTeamAttendance,
    getTeamLeaves,
    getTeamCorrections,
    getTeamSummary,
    approveLeave,
    approveCorrection,
    raiseFlag,
    // Admin
    getAllAttendance,
    adminOverride,
    getSettings,
    updateSettings,
    addHoliday,
    deleteHoliday,
    getHolidays,
    getAuditLog,
    getCompanyReport,
    resolveFlag,
    // Client
    getProjectTimesheets,
} from '../controllers/attendance.js';

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN-ONLY ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/all',              requireRole('admin'),           getAllAttendance);
router.post('/admin/override',  requireRole('admin'),           adminOverride);
router.get('/settings',         requireRole('admin'),           getSettings);
router.patch('/settings',       requireRole('admin'),           updateSettings);
router.post('/holidays',        requireRole('admin'),           addHoliday);
router.delete('/holidays/:id',  requireRole('admin'),           deleteHoliday);
router.get('/holidays',         requireRole('admin', 'manager', 'employee'), getHolidays);
router.get('/audit-log',        requireRole('admin'),           getAuditLog);
router.get('/company-report',   requireRole('admin'),           getCompanyReport);
router.patch('/flags/:id/resolve', requireRole('admin'),        resolveFlag);

// ═══════════════════════════════════════════════════════════════════════════════
// MANAGER ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/team',                     requireRole('admin', 'manager'), getTeamAttendance);
router.get('/team/leaves',              requireRole('admin', 'manager'), getTeamLeaves);
router.get('/team/corrections',         requireRole('admin', 'manager'), getTeamCorrections);
router.get('/team/summary',             requireRole('admin', 'manager'), getTeamSummary);
router.patch('/leaves/:id/approve',     requireRole('admin', 'manager'), approveLeave);
router.patch('/corrections/:id/approve', requireRole('admin', 'manager'), approveCorrection);
router.post('/flags',                   requireRole('admin', 'manager'), raiseFlag);

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/check-in',               requireRole('employee'), checkIn);
router.patch('/check-out',             requireRole('employee'), checkOut);
router.post('/breaks',                 requireRole('employee'), addBreak);
router.get('/my',                      requireRole('employee'), getMyAttendance);
router.get('/my/leaves',               requireRole('employee'), getMyLeaves);
router.post('/leaves',                 requireRole('employee'), applyLeave);
router.patch('/leaves/:id/cancel',     requireRole('employee'), cancelLeave);
router.post('/corrections',            requireRole('employee'), submitCorrection);
router.post('/on-duty',                requireRole('employee'), submitOnDuty);

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENT ROUTES — billing-safe only, no HR data
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/client/timesheets', requireRole('client'), getProjectTimesheets);

export default router;
