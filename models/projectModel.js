const pool = require("../config/db"); // Import the database connection pool

// ✅ Add a New Project
exports.addProject = async (name, Client,description, emp_id) => {
    try {
        const result = await pool.query(
            `INSERT INTO work_projects (name, Client, description, emp_id) VALUES ($1, $2, $3, $4) RETURNING *`,
            [name,Client, description, emp_id]
        );
        return result.rows[0];
    } catch (error) {
        console.error("Error adding project:", error);
        throw error;
    }
};

// ✅ Update an Existing Project
exports.updateProject = async (id, name, Client, description) => {
    try {
        const result = await pool.query(
            `UPDATE work_projects SET name = $1, Client = $2, description = $3 WHERE id = $4 RETURNING *`,
            [name, Client, description, id]
        );
        return result.rows[0];
    } catch (error) {
        console.error("Error updating project:", error);
        throw error;
    }
};


// ✅ Get All Projects
exports.getAllProjects = async () => {
    const result = await pool.query("SELECT id, name, Client, description, emp_id FROM work_projects"); // ✅ Ensure `id` is selected
    return result.rows;
};

 
exports.getProjectById = async (id) => {
    const result = await pool.query("SELECT id, name, Client, description FROM work_projects WHERE id = $1", [id]);
    return result.rows[0]; // ✅ Ensure it returns an object with `id`
};


// exports.getAllProjects = async () => {
//     const query = `SELECT name FROM public.work_projects ORDER BY name ASC;`;
//     const { rows } = await pool.query(query);
//     return rows; // Returns an array of project names
// };



 
// Model
exports.getTimeEntriesByDay = async (emp_id) => {
    return await pool.query(
        `SELECT id, work_description, project, start_time, end_time, date
         FROM time_entries_task
         WHERE emp_id = $1
         ORDER BY date DESC`, 
        [emp_id]
    );
};

exports.addTimeEntry = async (emp_id, work_description, project, start_time, end_time, date) => {
    const query = `
        INSERT INTO time_entries_task (emp_id, work_description, project, start_time, end_time, date)
        VALUES ($1, $2, $3, $4, $5, $6)
    `;

    const values = [emp_id, work_description, project, start_time, end_time, date];
    return await pool.query(query, values);
};

exports.updateTimeEntry = async (id, field, value) => {
    const query = `UPDATE time_entries_task SET ${field} = $1 WHERE id = $2`;
    return pool.query(query, [value, id]);
};

exports.updateTimeEntry = async (id, field, value) => {
    const query = `UPDATE time_entries_task SET ${field} = $1 WHERE id = $2`;
    return pool.query(query, [value, id]);
};




exports.findEmployee = async (emp_id) => {
    try {
        const result = await pool.query(
            `SELECT emp_id, name, emp_number, email, role, photo, designation, joining_date, assign_city,bank_number,ifsc FROM employees WHERE emp_id = $1`,
            [emp_id]
        );

        return result.rows[0] || null;
    } catch (error) {
        console.error("Error fetching employee:", error);
        throw error;
    }
};




// Fetch Employees for Dropdown
exports.getEmployees = async () => {
    return await pool.query(`
        SELECT emp_id, name 
        FROM public.employees 
        WHERE role = 'IT_Team';
    `);
};


// Fetch Work Summary Data
// Fetch Work Summary Data
// Fetch Work Summary Data
// exports.getTimeSummary = async (emp_id, project_id) => {
//     let query = `
//         SELECT emp_id, project, work_description, DATE(date) AS date, 
//                EXTRACT(EPOCH FROM (end_time - start_time)) / 3600 AS hours 
//         FROM public.time_entries_task
//     `;

//     let conditions = [];
//     let values = [];

//     if (emp_id) {
//         conditions.push(`emp_id = $${values.length + 1}`);
//         values.push(emp_id);
//     }
//     if (project_id) {
//         conditions.push(`project = $${values.length + 1}`);
//         values.push(project_id);
//     }

//     if (conditions.length) {
//         query += " WHERE " + conditions.join(" AND ");
//     }

//     query += " ORDER BY date ASC, emp_id;"; // 🔹 Order properly

//     return await pool.query(query, values);
// };
// exports.getTimeSummary = async (emp_id, project_id, start_date, end_date) => {
//     let query = `
//         SELECT emp_id, project, DATE(date) AS date, work_description, 
//                EXTRACT(EPOCH FROM (end_time - start_time)) / 3600 AS hours 
//         FROM public.time_entries_task
//     `;

//     let conditions = [];
//     let values = [];

//     if (emp_id) {
//         conditions.push(`emp_id = $${values.length + 1}`);
//         values.push(emp_id);
//     }
//     if (project_id) {
//         conditions.push(`project = $${values.length + 1}`);
//         values.push(project_id);
//     }
//     if (start_date) {
//         conditions.push(`date >= $${values.length + 1}`);
//         values.push(start_date);
//     }
//     if (end_date) {
//         conditions.push(`date <= $${values.length + 1}`);
//         values.push(end_date);
//     }

//     if (conditions.length) {
//         query += " WHERE " + conditions.join(" AND ");
//     }

//     query += " ORDER BY date ASC;";  // Ensure sorting by date

//     // console.log("Executing Query:", query, values);

//     const result = await pool.query(query, values);

//     // console.log("Query Result:", result.rows); // Log to verify data

//     return result;
// };


exports.getTimeSummary = async (emp_id, project_id, start_date, end_date) => {
    let query = `
        SELECT 
            emp_id, 
            project, 
            DATE(date) AS date, 
            work_description, 
            EXTRACT(EPOCH FROM (end_time - start_time)) / 3600 AS hours 
        FROM public.time_entries_task
    `;

    let conditions = [];
    let values = [];

    // Dynamically append conditions
    if (emp_id && emp_id !== '') {
        conditions.push(`emp_id = $${values.length + 1}`);
        values.push(emp_id);
    }

    if (project_id && project_id !== '') {
        conditions.push(`project = $${values.length + 1}`);
        values.push(project_id);
    }

    if (start_date && start_date !== '') {
        conditions.push(`date >= $${values.length + 1}`);
        values.push(start_date);
    }

    if (end_date && end_date !== '') {
        conditions.push(`date <= $${values.length + 1}`);
        values.push(end_date);
    }

    // Add WHERE clause if any conditions exist
    if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
    }

    // Sorting by date
    query += " ORDER BY date DESC, emp_id;";

    try {
        const result = await pool.query(query, values);
        return result;
    } catch (error) {
        console.error("Error executing getTimeSummary query:", error);
        throw error;
    }
};
// Get work summary data for a specific employee (filtered by emp_id)

// Fetch all projects from work_projects table
exports.getUserProjects = async (emp_id) => {
    console.log("Fetching projects for emp_id:", emp_id); // Debugging step

    const query = `
        SELECT id AS project_id, name AS project_name, description, client 
        FROM public.work_projects 
        WHERE emp_id = $1
    `;

    if (!emp_id) {
        console.error("emp_id is undefined or null!");
        return []; // Return an empty array if emp_id is invalid
    }

    const { rows } = await pool.query(query, [emp_id]);
    console.log("Fetched Projects:", rows);
    return rows;
};

exports.getAllProjectsForReport = async () => {
    const query = `
        SELECT id AS project_id, name AS project_name, description, client 
        FROM public.work_projects
        ORDER BY id DESC
    `;
    const { rows } = await pool.query(query);
    return rows;
};

// Get logged-in user's work summary data
exports.getTimeSummaryOwn = async (emp_id, project_id, start_date, end_date) => {
    let query = `
        SELECT id, emp_id, work_description, project, 
               start_time, end_time, date, created_at,
               EXTRACT(EPOCH FROM (end_time - start_time)) / 3600 AS hours
        FROM public.time_entries_task
    `;

    let conditions = [`emp_id = $1`];
    let values = [emp_id];

    if (project_id) {
        conditions.push(`project = $${values.length + 1}`);
        values.push(project_id);
    }
    if (start_date) {
        conditions.push(`date >= $${values.length + 1}`);
        values.push(start_date);
    }
    if (end_date) {
        conditions.push(`date <= $${values.length + 1}`);
        values.push(end_date);
    }

    query += " WHERE " + conditions.join(" AND ");
    query += " ORDER BY date DESC;";

    const { rows } = await pool.query(query, values);
    return rows;
};
