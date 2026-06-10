// leaveController.js
const pool = require("../config/db");
const employeeModel = require('../models/employeeModel');
const leaveModel = require("../models/leaveModel");

// Apply Leave
exports.applyLeave = async (req, res) => {
    try {
        const {
            emp_id,
            start_date,
            end_date,
            leave_type,
            half_day,
            reason,
            cc
        } = req.body;

        // Fetch employee details to verify leave balance
        const employee = await employeeModel.findEmployee(emp_id);
        if (!employee) {
            return res.status(400).json({ success: false, message: "Employee not found." });
        }

        const requestedDays = calculateDays(start_date, end_date, half_day);
        const leaveBalance = parseFloat(employee.leave_balance || 0);
        const festivalBalance = parseFloat(employee.festival_balance || 0);

        if (leave_type === 'Sick' || leave_type === 'Casual') {
            if (leaveBalance < requestedDays) {
                return res.status(400).json({ success: false, message: `Insufficient Casual/Sick Leave balance. You only have ${leaveBalance} days remaining.` });
            }
        } else if (leave_type === 'Festival Leave') {
            if (festivalBalance < requestedDays) {
                return res.status(400).json({ success: false, message: `Insufficient Festival Leave balance. You only have ${festivalBalance} days remaining.` });
            }

            const moment = require("moment");
            const requestedDates = [];
            let curr = moment(start_date);
            const end = moment(end_date);
            while (curr.isSameOrBefore(end, 'day')) {
                requestedDates.push(curr.format('YYYY-MM-DD'));
                curr.add(1, 'day');
            }

            const dbResult = await leaveModel.getFestivalLeavesByRange(start_date, end_date);
            const festivalDates = dbResult.map(row => moment(row.leave_date).format('YYYY-MM-DD'));

            for (const reqDate of requestedDates) {
                if (!festivalDates.includes(reqDate)) {
                    return res.status(400).json({ success: false, message: "This day is not in festival day" });
                }
            }
        }

        const applied_at = new Date();
        const status = 'pending';

        const result = await pool.query(
            `INSERT INTO public.leaves (emp_id, start_date, end_date, leave_type, half_day, reason, status, applied_at, cc, days)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [
                emp_id,
                start_date,
                end_date,
                leave_type,
                half_day,
                reason,
                status,
                applied_at,
                cc,
                requestedDays
            ]
        );

        res.json({ success: true, message: "Leave applied successfully", leave: result.rows[0] });
    } catch (error) {
        console.error('Error applying leave:', error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// List Leaves
exports.getLeaves = async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM public.leaves ORDER BY applied_at DESC`);
        res.json({ success: true, message: "successfully", leaves: result.rows });
    } catch (error) {
        console.error('Error fetching leaves:', error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

//for cc in list show
exports.getEmployeeList = async (req, res) => {
    try {
        const employees = await employeeModel.getEmployees();
        res.json({ success: true, employees });
    } catch (error) {
        console.error("Error fetching employees:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};


// Cancel Leave
exports.cancelLeave = async (req, res) => {
    try {
        const { leaveId } = req.body;

        const result = await pool.query(
            `UPDATE public.leaves SET status = 'Canceled' WHERE id = $1 AND status = 'pending' RETURNING *`,
            [leaveId]
        );

        if (result.rowCount === 0) {
            return res.status(400).json({ success: false, message: "Leave not found or already processed" });
        }

        res.json({ success: true, message: "Leave cancelled successfully", leave: result.rows[0] });
    } catch (error) {
        console.error('Error cancelling leave:', error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// Helper to calculate leave days
function calculateDays(start, end, half_day) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const timeDiff = endDate - startDate;
    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24)) + 1;
    return half_day ? 0.5 : days;
}



exports.getRegularizationData = async (req, res) => {
    try {
        const emp_id = req.body.emp_id;

        if (!emp_id) {
            return res.status(400).json({ success: false, error: "Employee ID required" });
        }

        const employee = await employeeModel.findEmployee(emp_id);
        const pendingRequests = await employeeModel.getPendingEmp(emp_id);
        const historyRequests = await employeeModel.getHistoryPermissions(emp_id);

        res.json({
            success: true,
            employee,
            pendingRequests,
            historyRequests
        });
    } catch (error) {
        console.error("Error fetching regularization data:", error);
        res.status(500).json({ success: false, error: "Server error" });
    }
};



exports.applyPermission = async (req, res) => {
    try {
        const { emp_id, type, from_time, to_time, reason } = req.body;

        if (!emp_id || !type || !from_time || !to_time || !reason) {
            return res.status(400).json({ success: false, error: "Missing required fields" });
        }

        // Check for duplicate permission request
        const duplicateExists = await employeeModel.checkDuplicatePermission(emp_id, from_time, to_time);
        if (duplicateExists) {
            return res.status(400).json({ success: false, error: "Already applied for this date and time" });
        }

        await employeeModel.applyPermission(emp_id, type, from_time, to_time, reason);

        res.json({ success: true, message: "Permission request submitted successfully" });
    } catch (error) {
        console.error("Error submitting permission:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};



exports.getPunchStatus = async (req, res) => {
    try {
        const emp_id = req.body.emp_id;
        console.log('✅ punch-status POST hit');
        if (!emp_id) {
            return res.status(400).json({ message: "Employee ID missing" });
        }

        const date = new Date().toISOString().split("T")[0];
        const activePunch = await employeeModel.getActivePunch(emp_id, date);

        res.json({ punchedIn: activePunch.length > 0 });
    } catch (error) {
        console.error("Punch status error:", error);
        res.status(500).json({ message: "Server error" });
    }
};
const moment = require('moment-timezone');

exports.getAttendanceByDate = async (req, res) => {
    try {
        const emp_id = req.body.emp_id;
        const date = req.body.date;

        if (!emp_id) {
            return res.status(400).json({ message: "Employee ID missing" });
        }

        if (!date) {
            return res.status(400).json({ message: "Date is required" });
        }

        const attendanceEntries = await employeeModel.getAttendance(emp_id, date);

        if (!attendanceEntries || attendanceEntries.length === 0) {
            return res.json({
                punch_in: "Not Available",
                punch_out: "Not Available",
                working_hours: "Not Available"
            });
        }

        let totalWorkingMinutes = 0;
        let firstPunchIn = null;
        let lastPunchOut = null;

        for (let i = 0; i < attendanceEntries.length; i++) {
            const entry = attendanceEntries[i];

            if (!firstPunchIn) firstPunchIn = entry.punch_in_time;
            lastPunchOut = entry.punch_out_time || lastPunchOut;

            if (entry.punch_in_time && entry.punch_out_time) {
                const punchInTime = moment(entry.punch_in_time);
                const punchOutTime = moment(entry.punch_out_time);
                totalWorkingMinutes += punchOutTime.diff(punchInTime, 'minutes');
            }
        }

        const workingHours =
            totalWorkingMinutes > 0
                ? `${Math.floor(totalWorkingMinutes / 60)}h ${totalWorkingMinutes % 60}m`
                : "Not Available";

        res.json({
            punch_in: firstPunchIn ? moment(firstPunchIn).format('YYYY-MM-DD HH:mm:ss') : "Not Available",
            punch_out: lastPunchOut ? moment(lastPunchOut).format('YYYY-MM-DD HH:mm:ss') : "Not Available",
            working_hours: workingHours
        });

    } catch (error) {
        console.error("Error fetching attendance:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ✅ Get Profile (JSON API)
exports.getProfileAPI = async (req, res) => {
    try {
        const { emp_id } = req.body;

        if (!emp_id) {
            return res.status(400).json({
                success: false,
                message: "emp_id is required"
            });
        }

        const employee = await employeeModel.findEmployee(emp_id);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        res.json({
            success: true,
            message: "Profile fetched successfully",
            data: employee
        });
    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });
    }
};


// ✅ Update Profile (JSON API)
exports.updateProfileAPI = async (req, res) => {
    try {
        const { emp_id, name, email, phone, dob, assign_city, designation, bank_number, ifsc } = req.body;

        if (!emp_id) {
            return res.status(400).json({
                success: false,
                message: "emp_id is required for update"
            });
        }

        const employee = await employeeModel.findEmployee(emp_id);
        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found"
            });
        }

        await employeeModel.updateEmployee(emp_id, {
            name,
            email,
            phone,
            dob,
            assign_city,
            designation,
            bank_number,
            ifsc
        });

        res.json({
            success: true,
            message: "Profile updated successfully"
        });
    } catch (error) {
        console.error("Profile update error:", error);
        res.status(500).json({
            success: false,
            message: error.message || "Internal Server Error"
        });
    }
};
