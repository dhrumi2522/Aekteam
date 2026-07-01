// routes/hrRoutes.js
const express = require('express');
const router = express.Router();
const hrController = require('../controllers/hrController');
const { verifyToken, requireHR } = require('../config/middleware');
const { upload } = require('../config/cloudinary');
const leaveController = require("../controllers/leaveController");
require("dotenv").config();
const pool = require('../config/db');

// ✅ Define File Upload Fields
const uploadFields = upload.fields([
    { name: "passbook_image", maxCount: 1 },
    { name: "pan_card", maxCount: 1 },
    { name: "aadhar_card", maxCount: 1 },
    { name: "offer_letter", maxCount: 1 },
    { name: "photo", maxCount: 1 },
    { name: "last_company_experience_letter", maxCount: 1 }
]);

router.get('/', verifyToken, requireHR, hrController.getHrDashboard);
router.get('/addEmployee', verifyToken, requireHR, hrController.getAddEmployeePage);
router.post('/addEmployee', uploadFields, verifyToken, requireHR, hrController.postAddEmployee);

// routes/hrRoutes.js
router.get("/employee-status", hrController.getEmployeesByStatus);

// 🚀 Employee Routes
router.get('/employee/edit/:emp_id', verifyToken, hrController.getEditEmployeePage);
router.post('/employee/update/:emp_id', uploadFields, hrController.postUpdateEmployee);

// Employee Delete Route
router.get('/employee/delete/:emp_id', verifyToken, requireHR, hrController.deleteEmployee);

router.get('/employees/list', verifyToken, requireHR, hrController.renderEmployeeList);

// Route to show an individual employee profile
router.get("/employee/:emp_id", verifyToken, requireHR, hrController.renderEmployeeProfile);

// ✅ HR Updates Leave Status
router.get('/approval', verifyToken, requireHR, leaveController.renderApprovalPage);

// HR - Update leave status (generic handler)
router.put('/update', verifyToken, requireHR, leaveController.updateLeaveStatus);

// HR - Approve leave
router.post('/approve', verifyToken, requireHR, (req, res) => {
    req.body.status = 'Approved';
    leaveController.updateLeaveStatus(req, res);
});

// HR - Reject leave
router.post('/reject', verifyToken, requireHR, (req, res) => {
    req.body.status = 'Rejected';
    leaveController.updateLeaveStatus(req, res);
});

router.get("/attendanceReport", verifyToken, requireHR, hrController.attendanceReport);
router.get("/exportAttendance", verifyToken, requireHR, hrController.exportAttendanceReport);
router.get("/employeeAttendanceDetails", verifyToken, requireHR, hrController.getEmployeeAttendanceDetails);

// Page to view and approve permissions
router.get("/approvePermission", verifyToken, requireHR, hrController.getPendingPermissions);

router.get("/getLeaves", verifyToken, requireHR, hrController.getLeaves);

router.get('/employeeLeaves', async (req, res) => {
    const { emp_id } = req.query;
    try {
        const query = `
      SELECT 
        emp_id, 
        generate_series(start_date, end_date, '1 day')::date AS date, 
        half_day 
      FROM leaves 
      WHERE emp_id = $1 AND status = 'approved'
      ORDER BY date DESC`;
        const result = await pool.query(query, [emp_id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.json([]);
    }
});

// ✅ NEW: JSON endpoint — festival leaves (used by monthly attendance report)
router.get("/festival-leaves-json", verifyToken, requireHR, async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT id, leave_date, name FROM festival_leaves ORDER BY leave_date ASC"
        );
        res.json({ success: true, leaves: result.rows });
    } catch (err) {
        console.error("Error fetching festival leaves JSON:", err);
        res.json({ success: false, leaves: [] });
    }
});

// ✅ NEW: JSON endpoint — employee leave balance (used by monthly attendance report)
router.get("/employeeLeaveBalance", verifyToken, requireHR, async (req, res) => {
    try {
        const { emp_id } = req.query;
        if (!emp_id) return res.json({ leave_balance: 0 });
        const result = await pool.query(
            "SELECT emp_id, name, leave_balance FROM employees WHERE emp_id = $1",
            [emp_id]
        );
        if (result.rows.length === 0) return res.json({ leave_balance: 0 });
        res.json(result.rows[0]);
    } catch (err) {
        console.error("Error fetching employee leave balance:", err);
        res.json({ leave_balance: 0 });
    }
});

// Approve permission
router.post("/approvePermission/:id", verifyToken, requireHR, hrController.approvePermission);

// Reject permission
router.post("/rejectPermission/:id", verifyToken, requireHR, hrController.rejectPermission);

router.get("/leaveHistory", verifyToken, requireHR, hrController.leaveHistory);

// Show Add Event form + All Events on the same page
router.get('/events/add', verifyToken, requireHR, hrController.showAddEvent);

// Submit Event (same page form)
router.post('/events/add', verifyToken, requireHR, hrController.addEvent);

// Festival Leave routes
router.get("/festival-leaves", verifyToken, requireHR, hrController.showFestivalLeaves);
router.post("/festival-leaves/add", verifyToken, requireHR, hrController.addFestivalLeave);
router.post("/festival-leaves/delete/:id", verifyToken, requireHR, hrController.deleteFestivalLeave);

const projectController = require("../controllers/projectController");
// Render Summary Report Page
router.get("/summary-reportHR", verifyToken, projectController.renderSummaryReport);

router.get('/apply-leave', verifyToken, requireHR, hrController.getHrApplyLeavePage);

// HR Submit Leave Application
router.post('/apply-leave', verifyToken, requireHR, hrController.postHrApplyLeave);

// HR Birthdays List Route
router.get('/birthdays-list', verifyToken, requireHR, hrController.getBirthdaysPage);

module.exports = router;
