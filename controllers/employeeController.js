const employeeModel = require('../models/employeeModel');
const pool = require('../config/db');

const moment = require('moment-timezone');
exports.getEmployeeHome = async (req, res) => {
    try {
        const emp_id = req.user.emp_id; // Extracted from JWT
        const employee = await employeeModel.findEmployee(emp_id);

        if (!employee) {
            return res.status(404).send("Employee not found");
        }

        // ✅ Fetch events (latest first)
        const events = await pool.query(
            `SELECT id, title, description, date 
       FROM public.events 
       ORDER BY date ASC`
        );

        // ✅ Get motivational quote
        const quotes = [
            "The great thing in this world is not so much where you stand, as in what direction you are moving. - Oliver Wendell Holmes",
            "Success is not the key to happiness. Happiness is the key to success. - Albert Schweitzer",
            "Believe you can and you're halfway there. - Theodore Roosevelt",
            "Do what you can, with what you have, where you are. - Theodore Roosevelt"
        ];

        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

        res.render("employee/home", {
            employee,
            randomQuote,
            events: events.rows,
        });
    } catch (error) {
        console.error("Error fetching employee home:", error);
        res.status(500).send("Internal Server Error");
    }
};



// exports.getProfile = async (req, res) => {
//     try {
//         const emp_id = req.user.emp_id; // Get employee ID from the logged-in user
//         const employee = await employeeModel.findEmployee(emp_id);

//         if (!employee) {
//             return res.status(404).render('error', { message: "Employee not found" });
//         }

//         res.render('employee/profile', { employee });
//     } catch (error) {
//         console.error("Error fetching profile:", error);
//         res.status(500).render('error', { message: "Internal Server Error" });
//     }
// };

exports.getProfile = async (req, res) => {
    try {
        const emp_id = req.user.emp_id;
        const employee = await employeeModel.findEmployee(emp_id);

        if (!employee) {
            return res.status(404).render("error", { message: "Employee not found" });
        }

        res.render("employee/profile", { employee, editable: true });
    } catch (error) {
        console.error("Error fetching profile:", error);
        res.status(500).render("error", { message: "Internal Server Error" });
    }
};

// ✅ Profile Update with Cloudinary
exports.updateProfile = async (req, res) => {
    try {
        const emp_id = req.user.emp_id;
        const data = req.body;

        // 🔹 Handle uploaded files from Cloudinary
        if (req.files) {
            for (const field in req.files) {
                if (req.files[field][0] && req.files[field][0].path) {
                    data[field] = req.files[field][0].path; // store Cloudinary URL
                }
            }
        }

        // 🔹 Update employee in DB
        await employeeModel.updateEmployee(emp_id, data);

        res.redirect("/dashboard/employee/profile?success=true");
    } catch (err) {
        console.error("Error updating profile:", err);
        res.redirect(`/dashboard/employee/profile?error=${encodeURIComponent(err.message)}`);
    }
};


// Punch In
// Punch In
const axios = require('axios');

// Punch In
// Punch In
exports.punchIn = async (req, res) => {
    try {
        const emp_id = req.user?.emp_id;
        let { latitude, longitude } = req.body;

        if (!emp_id) return res.status(400).json({ message: "Employee ID missing" });

        // If location missing → Allow punch-in with fallback
        const locationMissing = (!latitude || !longitude);
        if (locationMissing) {
            latitude = null;
            longitude = null;
        }

        // Reverse Geocode if location available
        let locationAddress = "Unknown Location";
        if (!locationMissing) {
            try {
                const geoResponse = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
                    params: { lat: latitude, lon: longitude, format: 'json' },
                    headers: { 'User-Agent': 'CompanyPunchSystem' }
                });
                locationAddress = geoResponse.data?.display_name || "Unknown Location";
            } catch (err) {
                locationAddress = "Unknown Location";
            }
        }

        const date = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');

        const permission = await employeeModel.getActivePermission(emp_id, date);
        if (permission.length > 0) {
            return res.status(400).json({ message: "Active permission exists. Punch-in not required." });
        }

        await employeeModel.punchIn(emp_id, date, latitude, longitude, locationAddress);

        res.status(200).json({
            message: locationMissing
                ? "Punched in successfully "
                : "Punched in successfully"
        });

    } catch (error) {
        console.error("Punch-in error:", error);
        res.status(500).json({ message: "Server error" });
    }
};


exports.punchOut = async (req, res) => {
    try {
        const emp_id = req.user?.emp_id;
        if (!emp_id) {
            return res.status(400).json({ message: "Employee ID missing" });
        }

        const date = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
        const time = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss'); // ✅ No milliseconds

        // Check if already punched out
        const activePunch = await employeeModel.getActivePunch(emp_id, date);
        if (activePunch.length === 0) {
            return res.status(400).json({ message: "No active punch-in found" });
        }

        // Punch out
        await employeeModel.punchOut(emp_id, date, time);
        res.status(200).json({ message: "Punched out successfully" });
    } catch (error) {
        console.error("Punch-out error:", error);
        res.status(500).json({ message: "Server error" });
    }
};



exports.renderRegularizationPage = async (req, res) => {
    try {
        const emp_id = req.user?.emp_id;
        const employee = await employeeModel.findEmployee(emp_id);
        const pendingRequests = await employeeModel.getPendingEmp(emp_id);
        const historyRequests = await employeeModel.getHistoryPermissions(emp_id);

        res.render('employee/Regularization', {
            employee,
            emp_id,
            pendingRequests,
            historyRequests
        });
    } catch (error) {
        console.error("Error rendering attendance page:", error);
        res.status(500).send("Server Error");
    }
};


exports.applyPermission = async (req, res) => {
    try {
        const emp_id = req.user?.emp_id;
        const { type, from_time, to_time, reason } = req.body;

        if (!emp_id) {
            return res.redirect("/dashboard/employee/apply-permission?error=Employee ID missing");
        }

        await employeeModel.applyPermission(emp_id, type, from_time, to_time, reason);

        // Redirect with success message
        res.redirect("/dashboard/employee/RegularizationPage?success=true");
    } catch (error) {
        console.error("Permission request error:", error);
        res.redirect(`/dashboard/employee/RegularizationPage?error=${encodeURIComponent(error.message)}`);
    }
};

exports.getWorkingHoursSummary = async (req, res) => {
    try {
        const emp_id = req.user?.emp_id;
        const { start_date, end_date } = req.query;

        if (!emp_id) {
            return res.status(400).json({ success: false, message: "Employee ID missing" });
        }

        // Default to 1st of current month to today if dates not provided
        const defaultStart = moment().startOf('month').format('YYYY-MM-DD');
        const defaultEnd = moment().format('YYYY-MM-DD');

        const startDate = start_date || defaultStart;
        const endDate = end_date || defaultEnd;

        // Get attendance data for the date range
        const attendanceData = await employeeModel.getAttendanceByDateRange(emp_id, startDate, endDate);

        // Calculate working days and hours
        let totalWorkingMinutes = 0;
        let workingDaysCount = 0;
        const dailyDetails = [];

        // Group by date
        const attendanceByDate = {};
        attendanceData.forEach(entry => {
            if (entry.punch_in_time) {
                const date = moment(entry.punch_in_time).format('YYYY-MM-DD');
                if (!attendanceByDate[date]) {
                    attendanceByDate[date] = [];
                }
                attendanceByDate[date].push(entry);
            }
        });

        // Calculate for each date
        for (const date in attendanceByDate) {
            let dayWorkingMinutes = 0;
            let punchEntries = [];

            const entries = attendanceByDate[date];

            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];

                if (entry.punch_in_time && entry.punch_out_time) {
                    const punchInTime = moment(entry.punch_in_time);
                    const punchOutTime = moment(entry.punch_out_time);
                    const sessionMinutes = punchOutTime.diff(punchInTime, 'minutes');
                    dayWorkingMinutes += sessionMinutes;

                    punchEntries.push({
                        punch_in: moment(entry.punch_in_time).format('HH:mm:ss'),
                        punch_out: entry.punch_out_time ? moment(entry.punch_out_time).format('HH:mm:ss') : '--:--:--',
                        session_hours: `${Math.floor(sessionMinutes / 60)}h ${sessionMinutes % 60}m`
                    });
                }
            }

            // Check if it's a weekend (Saturday=6, Sunday=0)
            const dayOfWeek = moment(date).day();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            if (dayWorkingMinutes > 0 && !isWeekend) {
                workingDaysCount++;
            }

            const dayTotalHours = dayWorkingMinutes > 0 ?
                `${Math.floor(dayWorkingMinutes / 60)}h ${dayWorkingMinutes % 60}m` : "0h 0m";

            totalWorkingMinutes += dayWorkingMinutes;

            dailyDetails.push({
                date: moment(date).format('DD-MM-YYYY'),
                day_of_week: moment(date).format('dddd'),
                is_weekend: isWeekend,
                total_hours: dayTotalHours,
                punch_entries: punchEntries,
                working_day: (dayWorkingMinutes > 0 && !isWeekend)
            });
        }

        // Calculate totals
        const totalWorkingHours = Math.floor(totalWorkingMinutes / 60);
        const totalWorkingMinutesRemainder = totalWorkingMinutes % 60;
        const averageDailyHours = workingDaysCount > 0 ?
            Math.floor(totalWorkingMinutes / workingDaysCount / 60) : 0;
        const averageDailyMinutes = workingDaysCount > 0 ?
            Math.floor((totalWorkingMinutes / workingDaysCount) % 60) : 0;

        res.json({
            success: true,
            summary: {
                start_date: startDate,
                end_date: endDate,
                total_days_in_range: moment(endDate).diff(moment(startDate), 'days') + 1,
                working_days_count: workingDaysCount,
                total_working_hours: `${totalWorkingHours}h ${totalWorkingMinutesRemainder}m`,
                average_daily_hours: `${averageDailyHours}h ${averageDailyMinutes}m`,
                total_working_minutes: totalWorkingMinutes
            },
            daily_details: dailyDetails
        });

    } catch (error) {
        console.error("Error getting working hours summary:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
};
exports.getPunchStatus = async (req, res) => {
    try {
        const emp_id = req.user?.emp_id;
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

exports.renderAttendancePage = async (req, res) => {
    try {
        const emp_id = req.user?.emp_id;
        const employee = await employeeModel.findEmployee(emp_id);

        // if (!emp_id) {
        //     return res.redirect('/login'); // Redirect if not logged in
        // }

        res.render('employee/attendance', { employee, emp_id });
    } catch (error) {
        console.error("Error rendering attendance page:", error);
        res.status(500).send("Server Error");
    }
};
exports.getAttendanceByDate = async (req, res) => {
    try {
        const emp_id = req.user?.emp_id;
        const date = req.query.date; // Get selected date

        if (!emp_id) {
            return res.status(400).json({ message: "Employee ID missing" });
        }

        const attendanceEntries = await employeeModel.getAttendance(emp_id, date);

        if (!attendanceEntries || attendanceEntries.length === 0) {
            return res.json({ punch_in: "Not Available", punch_out: "Not Available", working_hours: "Not Available" });
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

        const workingHours = totalWorkingMinutes > 0 ? `${Math.floor(totalWorkingMinutes / 60)}h ${totalWorkingMinutes % 60}m` : "Not Available";

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

