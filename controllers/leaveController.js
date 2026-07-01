const leaveModel = require("../models/leaveModel");
const employeeModel = require('../models/employeeModel');
const { sendLeaveAppliedMail, sendLeaveCanceledMail } = require("../utils/sendMail");

// ✅ Apply for Leave

exports.applyLeave = async (req, res) => {
    try {
        const emp_id = req.user.emp_id;
        const { start_date, end_date, leave_type, half_day, reason } = req.body;

        // Fetch employee details to verify leave balance
        const employee = await employeeModel.findEmployee(emp_id);
        if (!employee) {
            return res.status(400).json({ success: false, message: "Employee not found." });
        }

        let requestedDays;
        if (half_day) {
            requestedDays = 0.5;
        } else {
            const start = new Date(start_date);
            const end = new Date(end_date);
            requestedDays = Math.round((end - start) / (1000 * 3600 * 24)) + 1;
        }

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

        // Check for overlapping leaves
        const allLeaves = await leaveModel.getLeaves({ emp_id });
        const active = allLeaves.filter(lv => lv.status === 'pending' || lv.status === 'approved');

        const toStr = d => {
            const date = new Date(d);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        };

        // Find overlapping leaves using the standard interval overlap formula
        const overlaps = active.filter(lv => toStr(lv.start_date) <= end_date && toStr(lv.end_date) >= start_date);

        if (overlaps.length > 0) {
            if (!half_day) {
                // For Full Day requests, any overlap is blocked
                const dateStr = toStr(overlaps[0].start_date);
                return res.status(400).json({ success: false, message: `You have already applied leave on ${dateStr}.` });
            } else {
                // For Half Day requests, check if the specific half is covered
                const firstCovered = overlaps.some(lv => !lv.half_day || lv.half_day === '1st half');
                const secondCovered = overlaps.some(lv => !lv.half_day || lv.half_day === '2nd half');

                if (half_day === '1st half' && firstCovered) {
                    return res.status(400).json({ success: false, message: `You have already applied first half leave on ${start_date}.` });
                }
                if (half_day === '2nd half' && secondCovered) {
                    return res.status(400).json({ success: false, message: `You have already applied second half leave on ${start_date}.` });
                }
            }
        }

        // Save leave in DB
        const leave = await leaveModel.applyLeave({
            emp_id,
            start_date,
            end_date,
            leave_type,
            half_day,
            reason
        });

        // Send Email to HR (Commented out)
        // await sendLeaveAppliedMail(employee, leave);

        res.json({ success: true, message: "Leave applied successfully, HR notified!", leave });

    } catch (error) {
        console.error("Error applying leave:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

exports.cancelLeave = async (req, res) => {
    try {
        console.log("Received cancel leave request:", req.body); // Debug log

        const { leaveId } = req.body;
        if (!leaveId) {
            return res.status(400).json({ success: false, message: "Leave ID is required" });
        }

        // Check if leave exists and is still pending
        const leave = await leaveModel.findLeaveById(leaveId);
        if (!leave) {
            return res.status(400).json({ success: false, message: "Leave not found or already processed" });
        }

        // Get employee details for email before canceling
        const emp_id = req.user.emp_id;
        const employee = await employeeModel.findEmployee(emp_id);

        // Cancel leave (update status)
        const isCanceled = await leaveModel.cancelLeaveById(leaveId);
        if (!isCanceled) {
            return res.status(400).json({ success: false, message: "Failed to cancel leave" });
        }

        // Send Email to HR about cancellation
        try {
            await sendLeaveCanceledMail(employee, leave);
        } catch (emailError) {
            console.error("Error sending cancellation email:", emailError);
            // Don't fail the request if email fails
        }

        return res.json({ success: true, message: "Leave request canceled successfully, HR notified!" });

    } catch (error) {
        console.error("Error canceling leave:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// ✅ Get Leaves with Filters
exports.getLeaves = async (req, res) => {
    try {
        const filters = {
            emp_id: req.user.role !== "HR" ? req.user.emp_id : null,
            status: req.query.status,
            date: req.query.date,
        };

        const leaves = await leaveModel.getLeaves(filters);
        res.json({ success: true, leaves });
    } catch (error) {
        console.error("Error fetching leaves:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// ✅ HR Updates Leave Status
// exports.updateLeaveStatus = async (req, res) => {
//     try {


//         const { leave_id, status } = req.body;
//         const updatedLeave = await leaveModel.updateLeaveStatus(leave_id, status, req.user.emp_id);

//         res.json({ success: true, message: "Leave status updated", updatedLeave });
//     } catch (error) {
//         console.error("Error updating leave status:", error);
//         res.status(500).json({ success: false, message: "Server Error" });
//     }
// };
// ✅ Update leave status (used by approve/reject routes)
exports.updateLeaveStatus = async (req, res) => {
    try {
        const { leave_id, status } = req.body;

        await leaveModel.updateLeaveStatus(leave_id, status, req.user.emp_id);

        req.flash("success", `Leave request has been ${status.toLowerCase()} successfully!`);
    } catch (error) {
        console.error("Error updating leave status:", error);
        req.flash("error", "Something went wrong while updating leave status.");
    }
    res.redirect("/dashboard/hr/approval");
};

//for Hr
exports.renderApprovalPage = async (req, res) => {
    try {
        const emp_id = req.user.emp_id;
        const employee = await employeeModel.findEmployee(emp_id);
        const leaveApplications = await leaveModel.getPendingLeaves();

        res.render('leave-approval', {
            leaveApplications,
            employee,
            messages: req.flash()
        });
    } catch (error) {
        console.error('Error rendering approval page:', error);
        res.status(500).send('Server Error');
    }
};



exports.renderLeavePage = async (req, res) => {
    try {
        const emp_id = req.user?.emp_id;
        const employee = await employeeModel.findEmployee(emp_id);

        // if (!emp_id) {
        //     return res.redirect('/login'); // Redirect if not logged in
        // }
        const employeeData = await leaveModel.getEmployeeLeaveData(emp_id);
        res.render('employee/leave', { employee, emp_id, employeeData });
    } catch (error) {
        console.error("Error rendering attendance page:", error);
        res.status(500).send("Server Error");
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


const pool = require('../config/db');

// ✅ Get Upcoming Birthdays (filtered by role)
exports.getUpcomingBirthdays = async (req, res) => {
    try {
        const query = `
            SELECT emp_id, name, dob 
            FROM employees 
            WHERE dob IS NOT NULL 
            ORDER BY name
        `;

        const { rows: employees } = await pool.query(query);
        console.log("Fetched Employees with DOB:", employees);

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currentYear = today.getFullYear();

        const upcomingBirthdays = employees
            .map(emp => {
                let dob = new Date(emp.dob);

                // ✅ Fix for DD-MM-YYYY format
                if (isNaN(dob)) {
                    const parts = emp.dob.split("-");
                    if (parts.length === 3) {
                        const [day, month, year] = parts;
                        dob = new Date(`${year}-${month}-${day}`);
                    }
                }

                if (isNaN(dob)) {
                    console.warn(`Skipping invalid DOB for employee ID ${emp.emp_id}:`, emp.dob);
                    return null;
                }

                let nextBirthday = new Date(currentYear, dob.getMonth(), dob.getDate());
                if (nextBirthday < today) nextBirthday.setFullYear(currentYear + 1);

                const daysUntil = Math.ceil((nextBirthday - today) / (1000 * 60 * 60 * 24));

                const birthdayData = {
                    emp_id: emp.emp_id,
                    name: emp.name.trim(),
                    dob: emp.dob,
                    formatted_date: dob.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                    days_until: daysUntil
                };

                console.log(`Processed birthday for ${emp.name}:`, birthdayData);

                return birthdayData;
            })
            .filter(emp => emp && emp.days_until <= 30)
            .sort((a, b) => a.days_until - b.days_until);

        console.log("Final Upcoming Birthdays List:", upcomingBirthdays);

        res.json({ success: true, birthdays: upcomingBirthdays });

    } catch (error) {
        console.error("Error fetching birthdays:", error);
        res.status(500).json({ success: false, message: "Error fetching birthday data" });
    }
};
