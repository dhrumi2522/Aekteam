const employeeModel = require('../models/employeeModel');
const { addEmployee, getEmployees } = require('../models/employeeModel');
const ExcelJS = require("exceljs");
const leaveModel = require("../models/leaveModel");
const pool = require('../config/db');
const { sendLeaveAppliedMail, sendLeaveCanceledMail } = require("../utils/sendMail");

exports.getHrDashboard = async (req, res) => {
    try {
        const emp_id = req.user.emp_id;
        const employee = await employeeModel.findEmployee(emp_id);
        const totalEmployees = await employeeModel.employeeCount();

        const today = new Date().toISOString().split("T")[0];

        const leaveData = await employeeModel.getLeaveStats(today);
        const { present, absent } = await employeeModel.getAttendanceStats(today);

        console.log("Leave Data:", leaveData);
        console.log("Fixed Attendance Data:", { present, absent });

        res.render('hrDashboard', {
            user: req.user,
            employee,
            totalEmployees,
            leaveData,
            attendanceData: { present, absent }
        });

    } catch (error) {
        console.error("Error fetching HR dashboard data:", error);
        res.status(500).send("Internal Server Error");
    }
};

// controller/hrController.js
exports.getEmployeesByStatus = async (req, res) => {
    try {
        const { status, date } = req.query;
        const today = date || new Date().toISOString().split("T")[0];

        let employees = [];

        if (status === "present") {
            employees = await employeeModel.getPresentEmployees(today);
        } else if (status === "absent") {
            employees = await employeeModel.getAbsentEmployees(today);
        } else if (status === "leave") {
            employees = await employeeModel.getLeaveEmployees(today);
        }

        res.json({ success: true, employees });
    } catch (err) {
        console.error("Error fetching employees by status:", err);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

exports.getAddEmployeePage = async (req, res) => {
    const emp_id = req.user.emp_id;
    const employee = await employeeModel.findEmployee(emp_id);
    res.render('addEmployee', { employee });
};

exports.postAddEmployee = async (req, res) => {
    try {
        console.log("=== ADD EMPLOYEE REQUEST ===");
        console.log("Received Form Data:", req.body);
        console.log("Received Files:", req.files);

        if (!req.body.full_name || !req.body.phone) {
            return res.status(400).json({
                success: false,
                error: "Full Name and Phone are required fields."
            });
        }

        const employeeData = {
            full_name: req.body.full_name.trim(),
            phone: req.body.phone.trim(),
            designation: req.body.designation?.trim() || null,
            role: req.body.role?.trim() || 'employee',
            joining_date: req.body.joining_date || null,
            resign_date: req.body.resign_date || null,
            dob: req.body.dob || null,
            alt_phone: req.body.alt_phone?.trim() || null,
            city: req.body.city?.trim() || null,
            ctc: req.body.ctc?.trim() || null,
            bank_number: req.body.bank_number?.trim() || null,
            ifsc: req.body.ifsc?.trim() || null,
            last_company_name: req.body.last_company_name?.trim() || null,
            employment_status: req.body.employment_status?.trim() || 'full-time',
            passbook_image: req.files?.passbook_image?.[0]?.path || null,
            pan_card: req.files?.pan_card?.[0]?.path || null,
            aadhar_card: req.files?.aadhar_card?.[0]?.path || null,
            offer_letter: req.files?.offer_letter?.[0]?.path || null,
            photo: req.files?.photo?.[0]?.path || null,
            last_company_experience_letter: req.files?.last_company_experience_letter?.[0]?.path || null
        };

        console.log("Processed Employee Data:", employeeData);

        const newEmployee = await employeeModel.addEmployee(employeeData);

        res.json({
            success: true,
            message: "Employee added successfully!",
            employee: {
                emp_id: newEmployee.emp_id,
                name: newEmployee.name,
                emp_number: newEmployee.emp_number,
                pin: newEmployee.pin,
                designation: newEmployee.designation
            }
        });

    } catch (error) {
        console.error("Error adding employee:", error);

        let errorMessage = "Failed to add employee.";
        let statusCode = 500;

        if (error.code === '23505') {
            if (error.detail?.includes('emp_id')) {
                errorMessage = "Employee ID generation conflict. Please try again.";
            } else if (error.detail?.includes('pin')) {
                errorMessage = "PIN generation conflict. Please try again.";
            } else {
                errorMessage = "Duplicate entry found. Please check employee details.";
            }
            statusCode = 409;
        }

        res.status(statusCode).json({
            success: false,
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

exports.getEditEmployeePage = async (req, res) => {
    try {
        const emp_id = req.params.emp_id;
        const employee = await employeeModel.getEmployeeById(emp_id);

        if (!employee) {
            return res.status(404).send("Employee not found.");
        }

        res.render("editEmployee", { employee });
    } catch (error) {
        console.error("Error fetching employee data:", error);
        res.status(500).send("Internal Server Error");
    }
};

exports.postUpdateEmployee = async (req, res) => {
    try {
        console.log("Received Update Data:", req.body);
        console.log("Received Files:", req.files);

        const emp_id = req.params.emp_id;

        const updatedData = {};
        const fields = [
            "name", "emp_number", "email", "pin", "role", "token", "status",
            "assign_city", "isdeleted", "designation", "joining_date", "resign_date",
            "dob", "alt_phone", "ctc", "bank_number", "ifsc", "last_company_name",
            "leave_balance", "total_accrued_leave", "leave_taken", "employment_status"
        ];

        fields.forEach(field => {
            if (req.body[field] !== undefined) updatedData[field] = req.body[field] || null;
        });

        const fileFields = [
            "passbook_image", "pan_card", "aadhar_card", "offer_letter",
            "photo", "last_company_experience_letter"
        ];

        fileFields.forEach(field => {
            if (req.files?.[field]?.[0]?.path) {
                updatedData[field] = req.files[field][0].path;
            }
        });

        if (Object.keys(updatedData).length === 0) {
            return res.status(400).json({ success: false, error: "No data provided to update." });
        }

        const updatedEmployee = await employeeModel.updateEmployee(emp_id, updatedData);
        if (!updatedEmployee) {
            return res.status(404).json({ success: false, message: "Employee not found or update failed." });
        }

        res.json({ success: true, message: "Employee updated successfully!", employee: updatedEmployee });

    } catch (error) {
        console.error("Error updating employee:", error);
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
};

exports.deleteEmployee = async (req, res) => {
    try {
        const emp_id = req.params.emp_id;

        const employee = await employeeModel.getEmployeeById(emp_id);
        if (!employee) {
            return res.status(404).send("Employee not found.");
        }

        const deleted = await employeeModel.deleteEmployee(emp_id);
        if (!deleted) {
            return res.status(500).send("Failed to delete employee.");
        }

        res.redirect('/dashboard/hr/employees/list');

    } catch (error) {
        console.error("Error deleting employee:", error);
        res.status(500).send("Internal Server Error");
    }
};

exports.renderEmployeeList = async (req, res) => {
    try {
        const emp_id = req.user.emp_id;
        const employee = await employeeModel.findEmployee(emp_id);

        const employees = await getEmployees();
        res.render('Employeeslist', { employees, employee });
    } catch (error) {
        console.error("Error fetching employee list:", error);
        res.status(500).send("Error loading employee list.");
    }
};

exports.renderEmployeeProfile = async (req, res) => {
    try {
        const { emp_id } = req.params;
        const employee = await employeeModel.findEmployee(emp_id);

        if (!employee) {
            return res.status(404).send("Employee not found");
        }

        res.render("employeeProfile", { employee });
    } catch (error) {
        console.error("Error fetching employee profile:", error);
        res.status(500).send("Error loading employee profile.");
    }
};

// =========================
// HR: Attendance Report
// ✅ UPDATED: Added JSON mode for monthly report AJAX calls
// =========================
exports.attendanceReport = async (req, res) => {
    try {
        const { emp_id, start_date, end_date } = req.query;

        const employees = await employeeModel.findEmployees();
        const employee = req.user ? await employeeModel.findEmployee(req.user.emp_id) : null;

        let attendanceData = [];
        let summary = null;
        let isAllEmployees = emp_id === "all";

        if (emp_id && start_date && end_date) {
            // Fetch attendance
            attendanceData = await employeeModel.getAttendanceReport({ emp_id, start_date, end_date });

            if (isAllEmployees) {
                const empMap = {};

                attendanceData.forEach((rec) => {
                    if (!empMap[rec.emp_id]) {
                        empMap[rec.emp_id] = {
                            emp_id: rec.emp_id,
                            name: rec.name,
                            totalPresent: 0,
                            totalAbsent: 0,
                            totalOfficialLeave: 0,
                            totalTakenLeave: 0,
                            totalHalfDays: 0,
                            totalFestival: 0,
                        };
                    }

                    if (rec.status === "Present") {
                        empMap[rec.emp_id].totalPresent++;
                    } else if (rec.status === "Absent") {
                        empMap[rec.emp_id].totalAbsent++;
                    } else if (rec.status === "Official Leave") {
                        empMap[rec.emp_id].totalOfficialLeave++;
                    } else if (rec.status === "Taken Leave") {
                        empMap[rec.emp_id].totalTakenLeave++;
                    } else if (rec.status.includes("Half Day Paid")) {
                        empMap[rec.emp_id].totalAbsent += 0.5;
                    } else if (rec.status.includes("Half Day")) {
                        empMap[rec.emp_id].totalHalfDays += 0.5;
                    } else if (rec.status === "Festival Leave") {
                        empMap[rec.emp_id].totalFestival++;
                    }
                });

                // ✅ FORMULA: Total Leave Count = Taken Leave + Half Days×0.5 + Festival Leave
                summary = Object.values(empMap).map(emp => ({
                    ...emp,
                    totalLeaveCount: emp.totalTakenLeave + emp.totalHalfDays + emp.totalFestival
                }));
            } else {
                const totalPresent = attendanceData.filter((r) => r.status === "Present").length;
                const totalAbsent = attendanceData.filter((r) => r.status === "Absent").length +
                    attendanceData.filter((r) => r.status.includes("Half Day Paid")).length * 0.5;
                const totalOfficialLeave = attendanceData.filter((r) => r.status === "Official Leave").length;
                const totalTakenLeave = attendanceData.filter((r) => r.status === "Taken Leave").length;
                const totalHalfDays = attendanceData.filter((r) => r.status.includes("Half Day") && !r.status.includes("Paid")).length * 0.5;
                const totalFestival = attendanceData.filter((r) => r.status === "Festival Leave").length;

                summary = {
                    totalDays: attendanceData.length,
                    totalPresent,
                    totalAbsent,
                    totalOfficialLeave,
                    totalTakenLeave,
                    totalHalfDays,
                    totalFestival,
                    // ✅ FORMULA: Taken Leave + Half Days×0.5 + Festival Leave
                    totalLeaveCount: totalTakenLeave + totalHalfDays + totalFestival,
                };
            }
        }

        // ✅ NEW: JSON mode — used by monthly report AJAX fetch
        if (req.query.json === '1') {
            return res.json({
                success: true,
                attendanceData,
                summary,
                isAllEmployees
            });
        }

        res.render("attendanceReport", {
            employees,
            attendanceData,
            employee,
            summary,
            filters: { emp_id, start_date, end_date },
            isAllEmployees,
        });
    } catch (error) {
        console.error("Error fetching attendance report:", error);
        if (req.query.json === '1') {
            return res.status(500).json({ success: false, attendanceData: [], summary: null });
        }
        res.status(500).send("Internal Server Error");
    }
};

// =========================
// HR: Get Employee Attendance Details (for Modal Pop-up)
// =========================
exports.getEmployeeAttendanceDetails = async (req, res) => {
    try {
        const { emp_id, start_date, end_date } = req.query;

        if (!emp_id || !start_date || !end_date) {
            return res.status(400).json({ success: false, message: "Missing required parameters: emp_id, start_date, end_date." });
        }

        const attendanceData = await employeeModel.getAttendanceReport({ emp_id, start_date, end_date });

        // Map only what is needed for the modal to minimize network payload
        const filteredData = attendanceData.map(r => ({
            date: r.date,
            day: r.day,
            punch_in_time: r.punch_in_time,
            punch_out_time: r.punch_out_time,
            status: r.status
        }));

        res.json({
            success: true,
            attendanceData: filteredData
        });
    } catch (error) {
        console.error("Error fetching employee attendance details:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

// =========================
// HR: Export Attendance to Excel
// =========================
exports.exportAttendanceReport = async (req, res) => {
    try {
        const { emp_id, start_date, end_date } = req.query;

        if (!start_date || !end_date) {
            return res.status(400).send("Please select date range before exporting.");
        }

        const attendanceData = await employeeModel.getAttendanceReport({
            emp_id,
            start_date,
            end_date,
        });

        const workbook = new ExcelJS.Workbook();

        if (emp_id && emp_id !== "all") {
            const worksheet = workbook.addWorksheet("Employee Attendance");

            worksheet.columns = [
                { header: "Employee ID", key: "emp_id", width: 15 },
                { header: "Employee Name", key: "name", width: 22 },
                { header: "Date", key: "date", width: 15 },
                { header: "Day", key: "day", width: 15 },
                { header: "Punch In", key: "punch_in_time", width: 15 },
                { header: "Punch Out", key: "punch_out_time", width: 15 },
                { header: "Status", key: "status", width: 20 },
            ];

            const seen = new Set();
            const uniqueRecords = [];

            attendanceData.forEach((r) => {
                const key = `${r.emp_id}-${r.date}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueRecords.push(r);
                }
            });

            uniqueRecords.forEach((record) => {
                worksheet.addRow({
                    emp_id: record.emp_id,
                    name: record.name,
                    date: new Date(record.date).toLocaleDateString("en-IN"),
                    day: record.day,
                    punch_in_time: record.punch_in_time
                        ? new Date(record.punch_in_time).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                        })
                        : "-",
                    punch_out_time: record.punch_out_time
                        ? new Date(record.punch_out_time).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                        })
                        : "-",
                    status: record.status,
                });
            });

            const totalDays = uniqueRecords.length;
            const totalPresent = uniqueRecords.filter((r) => r.status === "Present").length;
            const totalAbsent = uniqueRecords.filter((r) => r.status === "Absent").length +
                uniqueRecords.filter((r) => r.status.includes("Half Day Paid")).length * 0.5;
            const totalFestival = uniqueRecords.filter((r) => r.status === "Festival Leave").length;
            const totalOfficialLeave = uniqueRecords.filter((r) => r.status === "Official Leave").length;
            const totalTakenLeave = uniqueRecords.filter((r) => r.status === "Taken Leave").length;
            const totalHalfDay = uniqueRecords.filter((r) => r.status.includes("Half Day") && !r.status.includes("Paid")).length;
            const halfDayValue = totalHalfDay * 0.5;
            // ✅ FORMULA: Total Leave = Taken Leave + Half Days×0.5 + Festival Leave
            const totalLeaves = totalTakenLeave + halfDayValue + totalFestival;

            worksheet.addRow({});
            worksheet.addRow(["Summary"]);
            worksheet.addRow(["Total Days", totalDays]);
            worksheet.addRow(["Present", totalPresent]);
            worksheet.addRow(["Absent (no punch)", totalAbsent]);
            worksheet.addRow(["Weekend Off (Official Leave)", totalOfficialLeave]);
            worksheet.addRow(["Taken Leave (Full Day)", totalTakenLeave]);
            worksheet.addRow(["Half-Day Leaves (0.5 each)", halfDayValue]);
            worksheet.addRow(["Festival Leave", totalFestival]);
            worksheet.addRow([]);
            worksheet.addRow(["Total Leave Count", totalLeaves]);
            worksheet.addRow(["Formula", `Taken Leave(${totalTakenLeave}) + Half Days(${halfDayValue}) + Festival Leave(${totalFestival}) = ${totalLeaves}`]);

            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FF007BFF" },
                };
            });
        } else {
            const worksheet = workbook.addWorksheet("All Employees Summary");

            worksheet.columns = [
                { header: "Employee ID", key: "emp_id", width: 15 },
                { header: "Employee Name", key: "name", width: 22 },
                { header: "Total Days", key: "total_days", width: 15 },
                { header: "Present", key: "present", width: 15 },
                { header: "Absent (no punch + unpaid leave)", key: "absent", width: 35 },
                { header: "Official Leave (Weekends)", key: "official_leave", width: 28 },
                { header: "Causal/Sick Leave", key: "casual_sick_taken", width: 25 },
                { header: "Festival Leave", key: "festival_taken", width: 18 },
                { header: "Total leave taken(Causal/Sick + Festival)", key: "total_leave_taken", width: 45 },
                { header: "Remaining Festival Balance", key: "remaining_festival_balance", width: 28 },
                { header: "Remaining Causal/Sick Leave", key: "remaining_leave_balance", width: 32 },
            ];

            const summaryMap = {};

            attendanceData.forEach((r) => {
                if (!summaryMap[r.emp_id]) {
                    summaryMap[r.emp_id] = {
                        emp_id: r.emp_id,
                        name: r.name,
                        total_days: 0,
                        present: 0,
                        absent: 0,
                        official_leave: 0,
                        taken_leave: 0,
                        half_leave: 0,
                        festival_taken: 0,
                        remaining_festival_balance: r.festival_balance !== undefined && r.festival_balance !== null ? parseFloat(r.festival_balance) : 0,
                        remaining_leave_balance: r.leave_balance !== undefined && r.leave_balance !== null ? parseFloat(r.leave_balance) : 0,
                    };
                }

                const emp = summaryMap[r.emp_id];
                emp.total_days++;

                if (r.status === "Present") emp.present++;
                else if (r.status === "Absent") emp.absent++;
                else if (r.status === "Official Leave") emp.official_leave++;
                else if (r.status === "Taken Leave") emp.taken_leave++;
                else if (r.status.includes("Half Day Paid")) emp.absent += 0.5;
                else if (r.status.includes("Half Day")) emp.half_leave += 0.5;
                else if (r.status === "Festival Leave") emp.festival_taken++;
            });

            // Post-process the totals per employee
            Object.values(summaryMap).forEach((emp) => {
                emp.casual_sick_taken = emp.taken_leave + emp.half_leave;
                emp.total_leave_taken = emp.casual_sick_taken + emp.festival_taken;
            });

            Object.values(summaryMap).forEach((emp) => worksheet.addRow(emp));

            worksheet.getRow(1).eachCell((cell) => {
                cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FF007BFF" },
                };
            });

            worksheet.addRow({});
            worksheet.addRow([
                "Report Duration",
                `${new Date(start_date).toLocaleDateString("en-IN")} → ${new Date(end_date).toLocaleDateString("en-IN")}`,
            ]);
        }

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=Attendance_Report_${Date.now()}.xlsx`
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Error exporting attendance report:", error);
        res.status(500).send("Error generating Excel file");
    }
};

// ==============================
// 🎉 FESTIVAL LEAVES MANAGEMENT
// ==============================

exports.showFestivalLeaves = async (req, res) => {
    try {
        const emp_id = req.user.emp_id;
        const employee = await employeeModel.findEmployee(emp_id);
        const result = await pool.query("SELECT * FROM festival_leaves ORDER BY leave_date ASC");
        res.render("festivalLeaves", { leaves: result.rows, employee });
    } catch (error) {
        console.error("Error loading festival leaves:", error);
        res.status(500).send("Internal Server Error");
    }
};

exports.addFestivalLeave = async (req, res) => {
    try {
        const { leave_date, name } = req.body;

        if (!leave_date || !name) {
            return res.status(400).json({ success: false, message: "Date and Name are required" });
        }

        // Check if a festival leave already exists for the selected date
        const duplicateCheck = await pool.query(
            "SELECT id FROM festival_leaves WHERE leave_date = $1",
            [leave_date]
        );

        if (duplicateCheck.rows.length > 0) {
            return res.status(400).json({ success: false, message: "Festival leave is already added on this date!" });
        }

        await pool.query(
            "INSERT INTO festival_leaves (leave_date, name) VALUES ($1, $2)",
            [leave_date, name]
        );

        res.json({ success: true, message: "Festival leave added successfully!" });
    } catch (error) {
        console.error("Error adding festival leave:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

exports.deleteFestivalLeave = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query("DELETE FROM festival_leaves WHERE id = $1", [id]);
        res.json({ success: true, message: "Festival leave deleted successfully!" });
    } catch (error) {
        console.error("Error deleting festival leave:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

exports.leaveHistory = async (req, res) => {
    try {
        const { emp_id, start_date, end_date } = req.query;
        const employee = await employeeModel.findEmployee(req.user.emp_id);
        const employees = await employeeModel.findEmployees();

        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split("T")[0];

        const startDate = start_date || firstDay;
        const endDate = end_date || lastDay;

        let leaveData = [];

        if (emp_id) {
            leaveData = await leaveModel.getLeaveHistory({ emp_id, start_date: startDate, end_date: endDate });
        }

        res.render("leaveHistory", {
            employee,
            employees,
            leaveData,
            filters: { emp_id, start_date: startDate, end_date: endDate }
        });

    } catch (error) {
        console.error("Error fetching leave history:", error);
        res.status(500).send("Internal Server Error");
    }
};

exports.getLeaves = async (req, res) => {
    try {
        const { emp_id } = req.query;
        const result = await pool.query(
            `SELECT start_date, end_date, leave_type, half_day, reason, status 
       FROM leaves 
       WHERE emp_id = $1 
       ORDER BY start_date DESC`,
            [emp_id]
        );
        res.json({ status: true, leaves: result.rows });
    } catch (error) {
        console.error("Error fetching leaves:", error);
        res.json({ status: false, leaves: [] });
    }
};

exports.getPendingPermissions = async (req, res) => {
    try {
        const employee = await employeeModel.findEmployee(req.user.emp_id);
        const pendingPermissions = await employeeModel.getPendingPermissions();
        res.render("approvePermission", { pendingPermissions, employee });
    } catch (error) {
        console.error("Error fetching pending permissions:", error);
        res.status(500).send("Internal Server Error");
    }
};

const moment = require("moment");

exports.approvePermission = async (req, res) => {
    try {
        const permissionId = req.params.id;
        const permission = await employeeModel.getPermissionById(permissionId);

        if (!permission) {
            return res.status(404).json({ message: "Permission not found" });
        }

        const attendanceDate = moment(permission.from_time).format("YYYY-MM-DD");

        if (!attendanceDate) {
            console.error("⚠️ Missing date in permission request.");
            return res.status(400).json({ message: "Invalid permission data: missing date." });
        }

        await employeeModel.updatePermissionStatus(permissionId, "Approved");

        const allowedTypes = ["regularization", "on duty", "wfh", "short break", "late in", "early out"];
        if (allowedTypes.includes(permission.type.toLowerCase())) {
            await employeeModel.updatePunchInOut(
                permission.emp_id,
                attendanceDate,
                permission.from_time,
                permission.to_time
            );
        }

        res.redirect("/dashboard/hr/approvePermission");
    } catch (error) {
        console.error("Approval error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

exports.rejectPermission = async (req, res) => {
    try {
        const permissionId = req.params.id;
        const permission = await employeeModel.getPermissionById(permissionId);

        if (!permission) {
            return res.status(404).json({ message: "Permission not found" });
        }

        await employeeModel.updatePermissionStatus(permissionId, "Rejected");
        res.redirect("/dashboard/hr/approvePermission");
    } catch (error) {
        console.error("Rejection error:", error);
        res.status(500).json({ message: "Server error" });
    }
};

exports.showAddEvent = async (req, res) => {
    try {
        const emp_id = req.user.emp_id;
        const employee = await employeeModel.findEmployee(emp_id);
        const events = await pool.query(
            `SELECT id, title, description, date FROM events ORDER BY date DESC`
        );
        res.render('addEvent', { events: events.rows, employee });
    } catch (err) {
        console.error(err);
        res.status(500).send('Error loading events');
    }
};

exports.addEvent = async (req, res) => {
    const { title, description, date } = req.body;
    try {
        await pool.query(
            'INSERT INTO events (title, description, date) VALUES ($1, $2, $3)',
            [title, description, date]
        );
        res.redirect('/dashboard/hr/events/add');
    } catch (err) {
        console.error(err);
        res.status(500).send('Error adding event');
    }
};

exports.getHrApplyLeavePage = async (req, res) => {
    try {
        const hr_id = req.user.emp_id;

        const employeeQuery = `SELECT emp_id, name, leave_balance, festival_balance FROM employees WHERE emp_id = $1`;
        const employeeResult = await pool.query(employeeQuery, [hr_id]);

        if (employeeResult.rows.length === 0) {
            return res.status(404).send("HR employee not found");
        }

        const pendingQuery = `SELECT * FROM leaves WHERE emp_id = $1 AND status = 'pending' ORDER BY applied_at DESC`;
        const pendingResult = await pool.query(pendingQuery, [hr_id]);

        const historyQuery = `SELECT * FROM leaves WHERE emp_id = $1 AND status IN ('approved', 'rejected') ORDER BY applied_at DESC LIMIT 10`;
        const historyResult = await pool.query(historyQuery, [hr_id]);

        res.render('apply-leave', {
            title: 'Apply Leave',
            user: req.user,
            employee: employeeResult.rows[0],
            pendingLeaves: pendingResult.rows,
            leaveHistory: historyResult.rows,
            error: null,
            success: null
        });

    } catch (error) {
        console.error("Error loading HR leave page:", error);
        res.status(500).render('error', {
            message: 'Failed to load leave application page',
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
};

exports.postHrApplyLeave = async (req, res) => {
    try {
        const { start_date, end_date, leave_type, duration, reason, cc } = req.body;
        const emp_id = req.user.emp_id;
        const half_day = duration === 'half-day';

        if (!start_date || !end_date || !leave_type) {
            return res.render('apply-leave', {
                title: 'Apply Leave',
                user: req.user,
                error: 'Please fill all required fields',
                success: null
            });
        }

        const start = new Date(start_date);
        const end = new Date(end_date);

        if (start > end) {
            return res.render('apply-leave', {
                title: 'Apply Leave',
                user: req.user,
                error: 'End date cannot be before start date',
                success: null
            });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (start < today) {
            return res.render('apply-leave', {
                title: 'Apply Leave',
                user: req.user,
                error: 'Cannot apply leave for past dates',
                success: null
            });
        }

        const overlapQuery = `
            SELECT id FROM leaves 
            WHERE emp_id = $1 
            AND status IN ('pending', 'approved')
            AND (
                (start_date BETWEEN $2 AND $3)
                OR (end_date BETWEEN $2 AND $3)
                OR ($2 BETWEEN start_date AND end_date)
                OR ($3 BETWEEN start_date AND end_date)
            )
        `;

        const overlapResult = await pool.query(overlapQuery, [emp_id, start_date, end_date]);

        if (overlapResult.rows.length > 0) {
            return res.render('apply-leave', {
                title: 'Apply Leave',
                user: req.user,
                error: 'You already have a leave request for these dates',
                success: null
            });
        }

        const leaveData = { emp_id, start_date, end_date, leave_type, half_day, reason: reason || '', cc: cc || '' };
        const leave = await leaveModel.applyLeave(leaveData);
        const employee = await employeeModel.findEmployee(emp_id);

        try {
            // Send Email to HR (Commented out)
            // await sendLeaveAppliedMail(employee, leave);
        } catch (emailError) {
            console.error("Failed to send email:", emailError);
        }

        const employeeQuery = `SELECT emp_id, name, leave_balance, festival_balance FROM employees WHERE emp_id = $1`;
        const employeeResult = await pool.query(employeeQuery, [emp_id]);

        const pendingQuery = `SELECT * FROM leaves WHERE emp_id = $1 AND status = 'pending' ORDER BY applied_at DESC`;
        const pendingResult = await pool.query(pendingQuery, [emp_id]);

        const historyQuery = `SELECT * FROM leaves WHERE emp_id = $1 AND status IN ('approved', 'rejected') ORDER BY applied_at DESC LIMIT 10`;
        const historyResult = await pool.query(historyQuery, [emp_id]);

        res.render('apply-leave', {
            title: 'Apply Leave',
            user: req.user,
            employee: employeeResult.rows[0],
            pendingLeaves: pendingResult.rows,
            leaveHistory: historyResult.rows,
            error: null,
            success: 'Leave application submitted successfully!'
        });

    } catch (error) {
        console.error("Error applying leave:", error);

        if (error.message === 'Insufficient leave balance') {
            return res.render('apply-leave', {
                title: 'Apply Leave',
                user: req.user,
                error: 'Insufficient leave balance',
                success: null
            });
        }

        res.render('apply-leave', {
            title: 'Apply Leave',
            user: req.user,
            error: 'Failed to apply leave. Please try again.',
            success: null
        });
    }
};
