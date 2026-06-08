
// models/employeeModel.js
const pool = require('../config/db');

//Login Models 
exports.findEmployeeById = async (emp_id) => {
  const result = await pool.query('SELECT * FROM employees WHERE emp_id = $1', [emp_id]);
  return result.rows[0];
};


exports.fetchEmployeesWithDob = async () => {
  const query = `
        SELECT emp_id, name, dob 
        FROM employees 
        WHERE dob IS NOT NULL
    `;
  const { rows } = await pool.query(query);
  return rows;
};

exports.employeeCount = async () => {  // Remove unnecessary emp_id parameter
  const result = await pool.query(`SELECT COUNT(*) AS total FROM employees`);
  return result.rows[0].total;  // ✅ Return only the total count
};







//For Add emp HR                                                                

// Get last employee ID to generate next emp_id
exports.getLastEmployeeId = async () => {
  const query = `SELECT emp_id FROM employees ORDER BY created_at DESC LIMIT 1;`;
  try {
    const result = await pool.query(query);
    if (result.rows.length > 0) {
      return result.rows[0].emp_id; // Last emp_id
    }
    return null; // No existing employee
  } catch (error) {
    console.error("Error fetching last employee ID:", error);
    throw error;
  }
};

// Generate new employee ID
// Generate new employee ID - FIXED VERSION
const generateEmpId = async () => {
  try {
    const result = await pool.query(
      "SELECT emp_id FROM employees ORDER BY created_at DESC LIMIT 1"
    );

    if (result.rows.length > 0) {
      const lastEmpId = result.rows[0].emp_id; // Example: "emp_99"

      // Extract number safely
      const match = lastEmpId.match(/emp_(\d+)/);
      if (match && match[1]) {
        const lastNumber = parseInt(match[1]);
        // Find the next available ID
        let nextNumber = lastNumber + 1;

        // Check if this ID already exists (in case of gaps)
        const checkQuery = "SELECT emp_id FROM employees WHERE emp_id = $1";
        const checkResult = await pool.query(checkQuery, [`emp_${nextNumber}`]);

        // If exists, keep incrementing until we find a free one
        while (checkResult.rows.length > 0) {
          nextNumber++;
          const recheckResult = await pool.query(checkQuery, [`emp_${nextNumber}`]);
          if (recheckResult.rows.length === 0) break;
        }

        return `emp_${nextNumber}`;
      }
    }
    // Start from emp_73 if table is empty or format doesn't match
    return 'emp_73';
  } catch (error) {
    console.error("Error generating emp_id:", error);
    // Fallback: generate based on timestamp
    const timestamp = Date.now();
    return `emp_${timestamp.toString().slice(-6)}`;
  }
};
const generatePin = async () => {
  let pin;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    pin = Math.floor(1000 + Math.random() * 9000).toString();
    const result = await pool.query(
      "SELECT emp_id FROM employees WHERE pin = $1 LIMIT 1",
      [pin]
    );

    // If pin doesn't exist, use it
    if (result.rows.length === 0) {
      return pin;
    }

    attempts++;
  } while (attempts < maxAttempts);

  // Fallback: timestamp based PIN
  return Math.floor(1000 + Date.now() % 9000).toString();
};
// Add new employee
exports.addEmployee = async (employeeData) => {
  const {
    full_name, phone, designation, joining_date, role, resign_date, dob, alt_phone,
    city, ctc, bank_number, ifsc, passbook_image, pan_card, aadhar_card,
    last_company_name, offer_letter, photo, last_company_experience_letter,
    employment_status
  } = employeeData;

  // Generate unique IDs
  const emp_id = await generateEmpId();
  const pin = await generatePin();

  // Ensure empty strings are converted to NULL
  const cleanValue = (value) => {
    if (value === "" || value === undefined || value === null) {
      return null;
    }
    return value;
  };

  // Check if emp_id already exists (extra safety)
  const checkExistQuery = "SELECT emp_id FROM employees WHERE emp_id = $1";
  const exists = await pool.query(checkExistQuery, [emp_id]);

  if (exists.rows.length > 0) {
    throw new Error(`Employee ID ${emp_id} already exists. Please try again.`);
  }

  // Calculate initial leave balance dynamically based on employment status
  let initialLeaveBalance = 1.5;
  if (employment_status === "probation") {
    initialLeaveBalance = 0.5;
  } else if (employment_status === "intern") {
    initialLeaveBalance = 0.0;
  } else if (employment_status === "full-time") {
    initialLeaveBalance = 1.5;
  }

  const query = `
      INSERT INTO employees 
      (emp_id, name, emp_number, designation, role, joining_date, resign_date, dob, 
      alt_phone, assign_city, ctc, bank_number, ifsc, passbook_image, pan_card, 
      aadhar_card, last_company_name, offer_letter, photo, last_company_experience_letter, 
      pin, leave_balance, created_at, updated_at, employment_status) 
      VALUES 
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 
       $17, $18, $19, $20, $21, $22, NOW(), NOW(), $23) 
      RETURNING *;
  `;

  try {
    console.log("Attempting to insert with emp_id:", emp_id);
    console.log("Generated PIN:", pin);

    const result = await pool.query(query, [
      emp_id,
      full_name,
      phone,
      designation,
      role,
      cleanValue(joining_date),
      cleanValue(resign_date),
      cleanValue(dob),
      cleanValue(alt_phone),
      cleanValue(city),
      cleanValue(ctc),
      cleanValue(bank_number),
      cleanValue(ifsc),
      passbook_image,
      pan_card,
      aadhar_card,
      cleanValue(last_company_name),
      offer_letter,
      photo,
      last_company_experience_letter,
      pin,
      initialLeaveBalance,
      cleanValue(employment_status)
    ]);

    console.log("Successfully inserted Employee:", result.rows[0].emp_id);
    return result.rows[0];
  } catch (error) {
    console.error("DB Insert Error Details:", {
      error: error.message,
      code: error.code,
      detail: error.detail,
      emp_id: emp_id
    });
    throw error;
  }
};

// Delete Employee from DB
exports.deleteEmployee = async (emp_id) => {
  const result = await pool.query(
    `DELETE FROM employees WHERE emp_id = $1 RETURNING emp_id`,
    [emp_id]
  );
  return result.rowCount > 0; // ✅ true if deleted, false if not found
};




exports.updateEmployee = async (emp_id, updatedData) => {
  const fields = [];
  const values = [];
  let i = 1;

  for (const key in updatedData) {
    if (updatedData[key] !== undefined) {
      fields.push(`${key}=$${i}`);
      values.push(updatedData[key]);
      i++;
    }
  }

  if (fields.length === 0) return null;

  values.push(emp_id);
  const query = `UPDATE employees SET ${fields.join(", ")}, updated_at=NOW() WHERE emp_id=$${i} RETURNING *`;
  const result = await pool.query(query, values);
  return result.rows[0];
};




exports.getEmployeeById = async (emp_id) => {
  try {
    const query = `
            SELECT emp_id, name, emp_number, email, pin, role, token, status, assign_city, isdeleted, 
                   designation, joining_date, resign_date, dob, alt_phone, ctc, bank_number, ifsc, 
                   passbook_image, pan_card, aadhar_card, last_company_name, offer_letter, photo, 
                   last_company_experience_letter, leave_balance, total_accrued_leave, leave_taken, festival_balance,
                   employment_status
            FROM employees 
            WHERE emp_id = $1;
        `;

    const result = await pool.query(query, [emp_id]);

    if (result.rows.length === 0) {
      return null; // Employee not found
    }

    return result.rows[0]; // Return employee data
  } catch (error) {
    console.error("Error fetching employee by ID:", error);
    throw error;
  }
};



// employee roll Dashboard 


exports.getEmployees = async () => {
  try {
    const result = await pool.query(
      `SELECT emp_id, name, emp_number, designation, joining_date, resign_date, dob, alt_phone, 
                    assign_city, ctc, bank_number, ifsc, passbook_image, pan_card, aadhar_card, 
                    last_company_name, offer_letter, photo, last_company_experience_letter, 
                    created_at, updated_at, employment_status 
             FROM employees 
             WHERE isdeleted = 0  -- Change false to 0
             ORDER BY created_at DESC`
    );

    return result.rows;
  } catch (error) {
    console.error("Error fetching employees:", error);
    throw error;
  }
};

// ✅ Find employee
exports.findEmployee = async (emp_id) => {
  try {
    const result = await pool.query(
      `SELECT emp_id, name, emp_number,pin, email, role, photo, designation, joining_date, 
              assign_city, dob, bank_number, ifsc, passbook_image, pan_card, aadhar_card, 
              offer_letter, last_company_experience_letter, leave_balance, festival_balance,
              employment_status 
       FROM employees 
       WHERE emp_id = $1`,
      [emp_id]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error("Error fetching employee:", error);
    throw error;
  }
};

// ✅ Update employee profile (specific subset of fields for employee portal)
exports.updateEmployeeProfile = async (emp_id, data) => {
  try {
    const query = `
      UPDATE employees SET 
        name = $1,
        email = $2,
        emp_number = $3,
        dob = $4,
        assign_city = $5,
        designation = $6,
        bank_number = $7,
        ifsc = $8,
        photo = COALESCE($9, photo),
        passbook_image = COALESCE($10, passbook_image),
        pan_card = COALESCE($11, pan_card),
        aadhar_card = COALESCE($12, aadhar_card),
        offer_letter = COALESCE($13, offer_letter),
        last_company_experience_letter = COALESCE($14, last_company_experience_letter),
        joining_date = $15,
        updated_at = NOW()
      WHERE emp_id = $16
    `;

    const values = [
      data.name,
      data.email,
      data.emp_number || data.phone,
      data.dob,
      data.assign_city,
      data.designation,
      data.bank_number,
      data.ifsc,
      data.photo,
      data.passbook_image,
      data.pan_card,
      data.aadhar_card,
      data.offer_letter,
      data.last_company_experience_letter,
      data.joining_date, // ✅ Added joining_date
      emp_id,
    ];

    await pool.query(query, values);
  } catch (error) {
    console.error("Error updating employee:", error);
    throw error;
  }
};





//for testing
// ✅ Fetch all employees
exports.findEmployees = async () => {
  try {
    const result = await pool.query("SELECT emp_id, name FROM employees");
    return result.rows; // Returns an array of employees
  } catch (error) {
    console.error("Database Error (findEmployees):", error);
    throw error;
  }
};

// ✅ Fetch attendance records with employee details
const moment = require("moment");
exports.getAttendanceReport = async ({ emp_id, start_date, end_date }) => {
  try {
    const allDates = [];
    let currentDate = moment(start_date);
    while (currentDate.isSameOrBefore(moment(end_date))) {
      allDates.push(currentDate.format("YYYY-MM-DD"));
      currentDate.add(1, "day");
    }

    const dateArray = allDates.length > 0 ? allDates : ["1900-01-01"];

    // ✅ Fetch all festival leave dates
    const festResult = await pool.query(
      "SELECT leave_date FROM festival_leaves WHERE leave_date BETWEEN $1 AND $2",
      [start_date, end_date]
    );
    const festivalDates = festResult.rows.map((r) =>
      moment(r.leave_date).format("YYYY-MM-DD")
    );

    // ✅ Fetch all approved leaves (full + half)
    const leaveResult = await pool.query(
      `SELECT emp_id, start_date, end_date, half_day, status, leave_type 
       FROM leaves 
       WHERE status = 'approved'
       AND (
         (start_date BETWEEN $1 AND $2)
         OR (end_date BETWEEN $1 AND $2)
         OR (start_date <= $1 AND end_date >= $2)
       )`,
      [start_date, end_date]
    );

    // ✅ Map leaves by emp_id and date
    const leaveMap = {}; // { emp_id: { 'YYYY-MM-DD': { type, half_day, leave_type } } }
    leaveResult.rows.forEach((lv) => {
      const start = moment(lv.start_date);
      const end = moment(lv.end_date);
      let loop = moment(start);

      while (loop.isSameOrBefore(end)) {
        const d = loop.format("YYYY-MM-DD");
        if (!leaveMap[lv.emp_id]) leaveMap[lv.emp_id] = {};
        leaveMap[lv.emp_id][d] = {
          type: lv.half_day ? "half" : "full",
          half_day: lv.half_day ? lv.half_day.toLowerCase() : null, // “1st half” or “2nd half”
          leave_type: lv.leave_type ? lv.leave_type.toLowerCase() : ""
        };
        loop.add(1, "day");
      }
    });

    // ✅ Fetch attendance data (distinct per emp/date)
    // ✅ Main attendance query with isdeleted filter added
    const query = `
      SELECT DISTINCT ON (dates.date, e.emp_id)
          dates.date,
          e.emp_id,
          e.name,
          e.role,
          e.leave_balance,
          e.festival_balance,
          a.punch_in_time,
          a.punch_out_time
      FROM (
          SELECT UNNEST($1::DATE[]) AS date
      ) AS dates
      CROSS JOIN employees e
      LEFT JOIN attendance a 
        ON e.emp_id = a.emp_id 
        AND dates.date = a.date
      WHERE 
        e.isdeleted = 0              -- 🔥 Added this line (only change)
        AND ($2::TEXT IS NULL OR $2::TEXT = 'all' OR e.emp_id = $2::TEXT)
      ORDER BY e.emp_id, dates.date, a.punch_in_time ASC;
    `;

    const result = await pool.query(query, [dateArray, emp_id || null]);
    const rows = result.rows;

    // ✅ Build final output with clean logic
    const finalData = rows.map((record) => {
      const dayName = moment(record.date).format("dddd");
      const roleName = (record.role || "").toLowerCase();
      const formattedDate = moment(record.date).format("YYYY-MM-DD");

      // ✅ Weekend logic: 
      // IT_Team, accountant, graphic_team → Saturday + Sunday (8 weekend days/month)
      // sales, maintenance, acquisition → Sunday only (4 weekend days/month)
      let isWeekend = false;
      const twoDayWeekendRoles = ["it_team", "graphic_team", "accountant", "hr"];
      const oneDayWeekendRoles = ["sales", "maintenance", "acquisition"];

      if (twoDayWeekendRoles.includes(roleName)) {
        // Saturday + Sunday off (8 days per month)
        isWeekend = ["Saturday", "Sunday"].includes(dayName);
      } else if (oneDayWeekendRoles.includes(roleName)) {
        // Sunday only off (4 days per month)
        isWeekend = dayName === "Sunday";
      } else {
        // Default: Sunday only for other roles
        isWeekend = dayName === "Sunday";
      }

      let status = "Absent"; // default

      // ✅ Priority 1: Festival Leave (highest priority)
      if (festivalDates.includes(formattedDate)) {
        status = "Festival Leave";
      }

      // ✅ Priority 2: Weekend → Always Official Leave (even if employee punched in)
      // Weekends should never be counted as Present, even if they worked
      else if (isWeekend) {
        status = "Official Leave";
      }

      // ✅ Priority 3: Approved Leave (Full/Half) - only if not weekend
      // Approved leaves should be "Taken Leave" not "Official Leave"
      else if (
        leaveMap[record.emp_id] &&
        leaveMap[record.emp_id][formattedDate]
      ) {
        const leaveInfo = leaveMap[record.emp_id][formattedDate];

        if (leaveInfo.type === "full") {
          if (leaveInfo.leave_type && leaveInfo.leave_type.includes("paid")) {
            status = "Absent";
          } else if (leaveInfo.leave_type && leaveInfo.leave_type.toLowerCase().includes("festival")) {
            status = "Festival Leave";
          } else {
            status = "Taken Leave"; // Full day approved leave
          }
        } else if (leaveInfo.type === "half") {
          const isPaid = leaveInfo.leave_type && leaveInfo.leave_type.includes("paid");
          status =
            leaveInfo.half_day === "1st half"
              ? (isPaid ? "Half Day Paid (1st Half)" : "Half Day (1st Half)")
              : (isPaid ? "Half Day Paid (2nd Half)" : "Half Day (2nd Half)");
        }
      }

      // ✅ Priority 4: Present (only if not weekend and has punch in/out)
      else if (record.punch_in_time && record.punch_out_time) {
        status = "Present";
      }

      return {
        ...record,
        status,
        day: dayName,
      };
    });

    return finalData;
  } catch (error) {
    console.error("Database Error (getAttendanceReport):", error);
    throw error;
  }
};


exports.findEmployeee = async (emp_id = null) => {
  let query = `SELECT emp_id, name FROM employees`;
  const params = [];

  if (emp_id) {
    query += ` WHERE emp_id = $1`;
    params.push(emp_id);
  }

  query += ` ORDER BY name`;

  const result = await pool.query(query, params);
  return result.rows || []; // Always return an array
};




//punch in - out funtion models

// Check if employee has already punched in today
exports.getTodayPunch = async (emp_id, date) => {
  const result = await pool.query(
    'SELECT * FROM attendance WHERE emp_id = $1 AND date = $2',
    [emp_id, date]
  );
  return result.rows;
};

// Insert punch-in record
exports.punchIn = async (emp_id, date, latitude, longitude, address) => {
  await pool.query(
    `INSERT INTO attendance 
         (emp_id, date, punch_in_time, punch_in_lat, punch_in_long, punch_in_address)
         VALUES ($1, $2, to_char(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS')::timestamp, $3, $4, $5)`,
    [emp_id, date, latitude, longitude, address]
  );
};
// Check if employee has punched in but not punched out
exports.getActivePunch = async (emp_id, date) => {
  const result = await pool.query(
    'SELECT * FROM attendance WHERE emp_id = $1 AND date = $2 AND punch_out_time IS NULL',
    [emp_id, date]
  );
  return result.rows;
};

// Update punch-out time
// Update punch-out time
exports.punchOut = async (emp_id, date) => {
  await pool.query(
    `UPDATE attendance 
         SET punch_out_time = to_char(NOW() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD HH24:MI:SS')::timestamp
         WHERE emp_id = $1 AND date = $2 AND punch_out_time IS NULL`,
    [emp_id, date]
  );
};

exports.getAttendanceByDateRange = async (emp_id, startDate, endDate) => {
  try {
    const result = await pool.query(
      `SELECT punch_in_time, punch_out_time 
             FROM attendance 
             WHERE emp_id = $1 
             AND DATE(punch_in_time) BETWEEN $2 AND $3
             AND punch_in_time IS NOT NULL
             ORDER BY punch_in_time ASC`,
      [emp_id, startDate, endDate]
    );
    return result.rows;
  } catch (error) {
    console.error("Database Error (getAttendanceByDateRange):", error);
    throw error;
  }
};

// exports.getAttendance = async (emp_id, date) => {
//     const result = await pool.query(
//         `SELECT 
//             to_char(punch_in_time, 'YYYY-MM-DD HH24:MI:SS') AS punch_in_time, 
//             to_char(punch_out_time, 'YYYY-MM-DD HH24:MI:SS') AS punch_out_time 
//          FROM attendance 
//          WHERE emp_id = $1 AND date = $2`,
//         [emp_id, date]
//     );
//     return result.rows[0] || null;
// };
exports.getAttendance = async (emp_id, date) => {
  const result = await pool.query(
    `SELECT 
            to_char(punch_in_time, 'YYYY-MM-DD HH24:MI:SS') AS punch_in_time, 
            to_char(punch_out_time, 'YYYY-MM-DD HH24:MI:SS') AS punch_out_time 
         FROM attendance 
         WHERE emp_id = $1 AND date = $2
         ORDER BY punch_in_time ASC`,
    [emp_id, date]
  );
  return result.rows || []; // Return all records instead of just one
};



//permison
exports.applyPermission = async (emp_id, type, from_time, to_time, reason) => {
  return pool.query(
    "INSERT INTO permissions (emp_id, type, from_time, to_time, reason) VALUES ($1, $2, $3, $4, $5)",
    [emp_id, type, from_time, to_time, reason]
  );
};

exports.getActivePermission = async (emp_id, date) => {
  return pool.query(
    "SELECT * FROM permissions WHERE emp_id = $1 AND from_time::date = $2 AND status = 'Approved'",
    [emp_id, date]
  );
};





// ✅ Get all pending permissions
// ✅ Get all pending permissions with employee name
exports.getPendingPermissions = async () => {
  try {
    const result = await pool.query(`
        SELECT 
          p.id,
          p.emp_id,
          e.name,
          p.type,
          p.from_time,
          p.to_time,
          p.reason,
          p.status
        FROM permissions p
        JOIN employees e ON p.emp_id = e.emp_id
        WHERE p.status = 'Pending'
        ORDER BY p.from_time DESC
      `);

    return result.rows;
  } catch (error) {
    console.error("Error fetching pending permissions:", error);
    throw error;
  }
};



exports.getPendingEmp = async (emp_id) => {
  try {
    const result = await pool.query(
      `SELECT id, type, from_time, to_time, reason, status, created_at 
             FROM permissions 
             WHERE emp_id = $1 AND status = 'Pending' 
             ORDER BY created_at DESC`,
      [emp_id]
    );
    return result.rows;
  } catch (error) {
    console.error("Database Error (getPendingPermissions):", error);
    throw error;
  }
};

exports.getHistoryPermissions = async (emp_id) => {
  try {
    const result = await pool.query(
      `SELECT id, type, from_time, to_time, reason, status, created_at, approved_at 
             FROM permissions 
             WHERE emp_id = $1 AND status IN ('Approved', 'Rejected') 
             ORDER BY created_at DESC`,
      [emp_id]
    );
    return result.rows;
  } catch (error) {
    console.error("Database Error (getHistoryPermissions):", error);
    throw error;
  }
};

// ✅ Get a specific permission by ID
exports.getPermissionById = async (id) => {
  try {
    const result = await pool.query("SELECT * FROM permissions WHERE id = $1", [id]);
    return result.rows.length ? result.rows[0] : null;
  } catch (error) {
    console.error("Database Error:", error);
    throw error;
  }
};

// ✅ Update permission status (Approved/Rejected)
exports.updatePermissionStatus = async (id, status) => {
  try {
    await pool.query("UPDATE permissions SET status = $1 WHERE id = $2", [status, id]);
  } catch (error) {
    console.error("Database Error:", error);
    throw error;
  }
};

// // ✅ Update punch-in time for Regularization approvals
// exports.updatePunchIn = async (emp_id, punch_in_time) => {
//     try {
//         await pool.query(
//             "UPDATE attendance SET punch_in = $1 WHERE emp_id = $2 AND date = CURRENT_DATE",
//             [punch_in_time, emp_id]
//         );
//     } catch (error) {
//         console.error("Database Error:", error);
//         throw error;
//     }
// }

// ✅ Update or insert punch-in time for Regularization approvals
// exports.updatePunchIn = async (emp_id, punch_in_time) => {
//     try {
//         // 1️⃣ Check if an attendance entry already exists for the employee today
//         const result = await pool.query(
//             `SELECT id FROM attendance WHERE emp_id = $1 AND date = CURRENT_DATE`,
//             [emp_id]
//         );

//         if (result.rows.length > 0) {
//             // 2️⃣ If entry exists, update the punch-in time
//             await pool.query(
//                 `UPDATE attendance 
//                  SET punch_in_time = $1
//                  WHERE emp_id = $2 AND date = CURRENT_DATE`,
//                 [punch_in_time, emp_id]
//             );
//             console.log(`✅ Punch-in updated for ${emp_id} at ${punch_in_time}`);
//         } else {
//             // 3️⃣ If no entry exists, insert a new record
//             await pool.query(
//                 `INSERT INTO attendance (emp_id, date, punch_in_time)
//                  VALUES ($1, CURRENT_DATE, $2)`,
//                 [emp_id, punch_in_time]
//             );
//             console.log(`✅ New punch-in record created for ${emp_id} at ${punch_in_time}`);
//         }
//     } catch (error) {
//         console.error("Database Error (updatePunchIn):", error);
//         throw error;
//     }
// };


// ✅ Update or insert punch-in & punch-out time for Regularization approvals
exports.updatePunchInOut = async (emp_id, date, punch_in_time, punch_out_time) => {
  try {
    // 1️⃣ Check if an attendance entry exists for the given date
    const result = await pool.query(
      `SELECT id FROM attendance WHERE emp_id = $1 AND date = $2`,
      [emp_id, date]
    );

    if (result.rows.length > 0) {
      // 2️⃣ If entry exists, update both punch-in and punch-out times
      await pool.query(
        `UPDATE attendance 
                 SET punch_in_time = $1, punch_out_time = $2
                 WHERE emp_id = $3 AND date = $4`,
        [punch_in_time, punch_out_time, emp_id, date]
      );
      console.log(`✅ Punch-in/out updated for ${emp_id} on ${date}`);
    } else {
      // 3️⃣ If no entry exists, insert a new record
      await pool.query(
        `INSERT INTO attendance (emp_id, date, punch_in_time, punch_out_time)
                 VALUES ($1, $2, $3, $4)`,
        [emp_id, date, punch_in_time, punch_out_time]
      );
      console.log(`✅ New attendance record created for ${emp_id} on ${date}`);
    }
  } catch (error) {
    console.error("Database Error (updatePunchInOut):", error);
    throw error;
  }
};













// ✅ Get leave stats for a given date
exports.getLeaveStats = async (date) => {
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM public.leaves 
         WHERE status = 'approved' 
         AND start_date <= $1 
         AND end_date >= $1`,

    [date]
  );
  return result.rows[0].count;
};

// ✅ Get attendance stats for a given date
exports.getAttendanceStats = async (date) => {
  const presentResult = await pool.query(
    `SELECT COUNT(DISTINCT emp_id) as present 
         FROM public.attendance WHERE date = $1`,
    [date]
  );

  const totalEmployeesResult = await pool.query(
    `SELECT COUNT(*) as total FROM public.employees`
  );

  // Extract correct values and ensure they are numbers
  const present = parseInt(presentResult.rows[0].present, 10) || 0;
  const totalEmployees = parseInt(totalEmployeesResult.rows[0].total, 10) || 0;
  const absent = totalEmployees - present;

  return { present, absent };
};


// models/employeeModel.js

// ✅ Employees who are present today
// ✅ Employees who are present today
exports.getPresentEmployees = async (date) => {
  const result = await pool.query(
    `SELECT e.emp_id, e.name, e.role
         FROM public.employees e
         INNER JOIN public.attendance a 
         ON e.emp_id = a.emp_id
         WHERE a.date = $1`,
    [date]
  );
  return result.rows;
};

// ✅ Employees who are absent today
exports.getAbsentEmployees = async (date) => {
  const result = await pool.query(
    `SELECT e.emp_id, e.name, e.role
         FROM public.employees e
         WHERE e.emp_id NOT IN (
            SELECT emp_id FROM public.attendance WHERE date = $1
         )
         AND e.emp_id NOT IN (
            SELECT emp_id FROM public.leaves 
            WHERE status = 'approved' AND start_date <= $1 AND end_date >= $1
         )`,
    [date]
  );
  return result.rows;
};

// ✅ Employees who are on leave
exports.getLeaveEmployees = async (date) => {
  const result = await pool.query(
    `SELECT e.emp_id, e.name, e.role
         FROM public.employees e
         INNER JOIN public.leaves l
         ON e.emp_id = l.emp_id
         WHERE l.status = 'approved' 
           AND l.start_date <= $1 
           AND l.end_date >= $1`,
    [date]
  );
  return result.rows;
};

