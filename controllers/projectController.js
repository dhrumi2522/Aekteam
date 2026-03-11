const projectModel = require("../models/projectModel");
const allowedEmpIds = ["emp_43", "emp_32", "emp_33"];  // Only these employees can add projects

// ✅ Fetch All Projects & Show Add Project Form
exports.getProjectsPage = async (req, res) => {
    try {
        const emp_id = req.user.emp_id;
        const projects = await projectModel.getAllProjects();
        // console.log("Fetched Projects from DB:", projects); // Debugging

        const employee = await projectModel.findEmployee(emp_id);
        const canAddProjects = allowedEmpIds.includes(req.user.emp_id);
        
        res.render("projects/projectsPage", { projects, canAddProjects, employee });
    } catch (error) {
        console.error("Error fetching projects:", error);
        res.status(500).send("Internal Server Error");
    }
};
// ✅ Create a New Project
exports.createProject = async (req, res) => {
    try {
        if (!allowedEmpIds.includes(req.user.emp_id)) {
            return res.status(403).send("You are not authorized to add projects.");
        }

        const { name,Client, description } = req.body;
        await projectModel.addProject(name,Client, description, req.user.emp_id);

        res.redirect("/dashboard/employee/projects"); // Reload the same page after adding
    } catch (error) {
        console.error("Error creating project:", error);
        res.status(500).send("Internal Server Error");
    }
};

exports.getProjectById = async (req, res) => {
    try {
        const project = await projectModel.getProjectById(req.params.id);
        console.log("Fetched Project from DB:", project); // Debugging

        if (!project || !project.id) {
            return res.status(404).json({ error: "Project not found" });
        }

        res.json(project);
    } catch (error) {
        console.error("Error fetching project:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

// ✅ Edit an Existing Project
// ✅ Edit Project
exports.editProject = async (req, res) => {
    try {
        if (!allowedEmpIds.includes(req.user.emp_id)) {
            return res.status(403).json({ error: "You are not authorized to edit projects." });
        }

        const id = req.params.id;

        if (!id || isNaN(Number(id))) {
            return res.status(400).json({ error: "Invalid project ID." });
        }

        const { name, client, description } = req.body; // Ensure consistency with frontend

        if (!name || !client || !description) {
            return res.status(400).json({ error: "All fields are required." });
        }

        const updatedProject = await projectModel.updateProject(id, name, client, description);
        res.json({ message: "Project updated successfully!", project: updatedProject });
    } catch (error) {
        console.error("Error updating project:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};




//work report
// Controller
exports.getTimeEntriesByDay = async (req, res) => {
    try {
        const emp_id = req.user.emp_id;
        const { rows } = await projectModel.getTimeEntriesByDay(emp_id);
        const projects = await projectModel.getAllProjects();
        const employee = await projectModel.findEmployee(emp_id);

        // ✅ Group data by date
        const groupedEntries = rows.reduce((acc, entry) => {
            const date = entry.date ? entry.date.toISOString().split("T")[0] : "Unknown Date";
            entry.id = entry.id ? entry.id.toString() : "MISSING_ID";

            if (!acc[date]) acc[date] = [];
            acc[date].push(entry);
            return acc;
        }, {});

        // ✅ Function to calculate hours worked
        const calculateHours = (start, end) => {
            if (!start || !end) return "0.00";
            const startTime = new Date(`1970-01-01T${start}Z`);
            const endTime = new Date(`1970-01-01T${end}Z`);
            let diff = (endTime - startTime) / (1000 * 60 * 60);
            return diff < 0 ? (diff + 24).toFixed(2) : diff.toFixed(2);
        };

        res.render("projects/addTask", { 
            timeEntries: groupedEntries, 
            calculateHours, 
            employee, 
            projects 
        });

    } catch (error) {
        console.error("❌ Error fetching time entries:", error);
        res.status(500).send("Internal Server Error");
    }
};

exports.addTimeEntry = async (req, res) => {
    try {
        const { work_description, project, start_time, end_time, date } = req.body;
        const userId = req.user.emp_id;
        
        // Use provided date or default to today
        const entryDate = date || new Date().toISOString().split("T")[0];

        await projectModel.addTimeEntry(userId, work_description, project, start_time, end_time, entryDate);
        res.redirect("/dashboard/employee/projects/addTask");
    } catch (error) {
        console.error("Error adding time entry:", error);
        res.status(500).send("Internal Server Error");
    }
};

exports.updateTimeEntry = async (req, res) => {
    try {
        const { id, field, value } = req.body;
        
        if (!id || isNaN(id)) {
            return res.status(400).json({ success: false, message: "Invalid or missing ID" });
        }

        await projectModel.updateTimeEntry(parseInt(id), field, value);
        res.json({ success: true, message: "Time entry updated successfully" });
    } catch (error) {
        console.error("Error updating time entry:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};





// Render the Summary Report Page
exports.renderSummaryReport = async (req, res) => {
    const emp_id = req.user.emp_id; 
    
    // const employee = await projectModel.findEmployee(emp_id);
    const employee = await projectModel.findEmployee(emp_id);
                
    const projects = await projectModel.getAllProjectsForReport();
    
    res.render("projects/summaryReport", {
    employee,
    projects,
    role: req.user.role
}); 
};

// Get Employees
exports.getEmployees = async (req, res) => {
    try {
        const { rows } = await projectModel.getEmployees();
        res.json(rows);
    } catch (error) {
        console.error("Error fetching employees:", error);
        res.status(500).send("Error fetching employees");
    }
};

// Get Work Summary Data
// Get Work Summary Data
exports.getSummary = async (req, res) => {
    try {
        let { emp_id, project_id, start_date, end_date, prev_month } = req.query;

        // Adjust dates for previous month if requested
        if (prev_month === "true") {
            let today = new Date();
            let firstDayPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            let lastDayPrevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
            
            start_date = firstDayPrevMonth.toISOString().slice(0, 10);
            end_date = lastDayPrevMonth.toISOString().slice(0, 10);
        }

        // Fetch summary data from database
        const result = await projectModel.getTimeSummary(emp_id, project_id, start_date, end_date);
        const rows = result.rows;

        // Data structures for processing
        let dailyEntries = [];
        let projectSummary = {};
        let employeeMap = {};

        // First, fetch employee names for all emp_ids in the result
        const empIds = [...new Set(rows.map(row => row.emp_id))];
        
        // Process each row
        for (const row of rows) {
            // Get employee name if not already in map
            if (!employeeMap[row.emp_id]) {
                try {
                    const employee = await projectModel.findEmployee(row.emp_id);
                    employeeMap[row.emp_id] = employee ? employee.name : row.emp_id;
                } catch (err) {
                    employeeMap[row.emp_id] = row.emp_id;
                }
            }

            // Create daily entry with all details
            const dailyEntry = {
                date: row.date,
                emp_id: row.emp_id,
                emp_name: employeeMap[row.emp_id],
                project: row.project,
                work_description: row.work_description,
                hours: parseFloat(row.hours) || 0
            };
            
            dailyEntries.push(dailyEntry);

            // Aggregate project-wise summary
            if (!projectSummary[row.project]) {
                projectSummary[row.project] = 0;
            }
            projectSummary[row.project] += parseFloat(row.hours) || 0;
        }

        // Sort daily entries by date (descending) for better display
        dailyEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({ 
            daily: dailyEntries, 
            projectWise: projectSummary 
        });

    } catch (error) {
        console.error("Error fetching summary data:", error);
        res.status(500).json({ error: "Error fetching summary data" });
    }
};




//testing
exports.renderSummaryOwnReport = async (req, res) => {
    try {
        const emp_id = req.user.emp_id; 

        const employee = await projectModel.findEmployee(emp_id);
     
        
        const projects = await projectModel.getAllProjectsForReport(); // Fetch all projects
      
        

        res.render("projects/summaryOwnReport", { projects,employee }); // Send projects to EJS
    } catch (error) {
        console.error("Error loading summary report:", error);
        res.status(500).send("Error loading report");
    }
};


exports.getOwnSummary = async (req, res) => {
    try {
        const emp_id = req.user.emp_id;
        const { project_id, start_date, end_date } = req.query;

        // Fetch the logged-in user's summary data
        const data = await projectModel.getTimeSummaryOwn(emp_id, project_id, start_date, end_date);
        
        res.json(data);
    } catch (error) {
        console.error("Error fetching personal summary data:", error);
        res.status(500).send("Error fetching personal summary data");
    }
};

// exports.getProjects = async (req, res) => {
//     try {
//         const { rows } = await projectModel.getAllProjectsForReport();
//         res.json(rows);
//     } catch (error) {
//         console.error("Error fetching projects:", error);
//         res.status(500).send("Error fetching projects");
//     }
// // };
// exports.getProjects = async (req, res) => {
//     try {
//         // const result = await projectModel.getAllProjectsForReport();

//         // // Ensure result and result.rows exist
//         // if (!result || !result.rows) {
//         //     console.error("Error: No data returned from getAllProjectsForReport");
//         //     return res.status(500).json({ error: "Error fetching projects" });
//         // }

//         res.json(result.rows.length > 0 ? result.rows : []);
//     } catch (error) {
//         console.error("Error fetching projects:", error);
//         res.status(500).json({ error: "Error fetching projects" });
//     }
// };
