// routes/attendance.js  (ES Module version)
import express from "express";
import jwt     from "jsonwebtoken";
import pool    from "../db.js";
import { sendLeaveSubmitted, sendLeaveReviewed } from "../utils/mailer.js";

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET || "hrms_secret");
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

function hrOnly(req, res, next) {
  if (req.user.role !== "hr") return res.status(403).json({ error: "HR only" });
  next();
}

function fireEmail(fn, ...args) {
  fn(...args).catch(err => console.error("[mailer]", err.message));
}

// ─────────────────────────────────────────────────────────────────────────────
// ATTENDANCE ROUTES
// ─────────────────────────────────────────────────────────────────────────────

router.get("/daily", auth, hrOnly, async (req, res) => {
  const { date = new Date().toISOString().split("T")[0] } = req.query;
  try {
    const result = await pool.query(
      `SELECT
         u.id, u.first_name, u.last_name, u.email, u.department, u.employee_id,
         COALESCE(a.status, 'absent') AS status,
         a.clock_in, a.clock_out, a.notes, a.id AS attendance_id
       FROM users u
       LEFT JOIN attendance a ON a.user_id = u.id AND a.date = $1
       WHERE u.role = 'employee'
       ORDER BY u.first_name`,
      [date]
    );
    res.json({ date, employees: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/weekly", auth, async (req, res) => {
  const userId = req.query.user_id || req.user.id;
  if (req.user.role === "employee" && String(userId) !== String(req.user.id))
    return res.status(403).json({ error: "Forbidden" });
  try {
    const result = await pool.query(
      `SELECT date, status, clock_in, clock_out
       FROM attendance
       WHERE user_id = $1
         AND date >= CURRENT_DATE - INTERVAL '6 days'
         AND date <= CURRENT_DATE
       ORDER BY date ASC`,
      [userId]
    );
    res.json({ user_id: userId, records: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/summary", auth, hrOnly, async (req, res) => {
  const { date = new Date().toISOString().split("T")[0] } = req.query;
  try {
    const totalRes = await pool.query(`SELECT COUNT(*) AS total FROM users WHERE role = 'employee'`);
    const total    = parseInt(totalRes.rows[0].total, 10);
    const counts   = await pool.query(
      `SELECT status, COUNT(*) AS count FROM attendance WHERE date = $1 GROUP BY status`,
      [date]
    );
    const summary = { present: 0, late: 0, leave: 0, wfh: 0, absent: 0 };
    counts.rows.forEach(r => { summary[r.status] = parseInt(r.count, 10); });
    const accounted = Object.values(summary).reduce((a, b) => a + b, 0);
    summary.absent  = total - accounted + summary.absent;
    summary.total   = total;
    res.json({ date, summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/clock-in", auth, async (req, res) => {
  const userId = req.user.id;
  const today  = new Date().toISOString().split("T")[0];
  const now    = new Date();
  const status = (now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 30)) ? "late" : "present";
  try {
    const result = await pool.query(
      `INSERT INTO attendance (user_id, date, status, clock_in)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, date)
         DO UPDATE SET clock_in = NOW(), status = $3, updated_at = NOW()
       RETURNING *`,
      [userId, today, status]
    );
    res.json({ message: "Clocked in", record: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/clock-out", auth, async (req, res) => {
  const userId = req.user.id;
  const today  = new Date().toISOString().split("T")[0];
  try {
    const result = await pool.query(
      `UPDATE attendance SET clock_out = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND date = $2 RETURNING *`,
      [userId, today]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "No clock-in record found for today" });
    res.json({ message: "Clocked out", record: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/mark", auth, hrOnly, async (req, res) => {
  const { user_id, date, status, notes } = req.body;
  if (!user_id || !date || !status)
    return res.status(400).json({ error: "user_id, date, status are required" });
  try {
    const result = await pool.query(
      `INSERT INTO attendance (user_id, date, status, notes, marked_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, date)
         DO UPDATE SET status = $3, notes = $4, marked_by = $5, updated_at = NOW()
       RETURNING *`,
      [user_id, date, status, notes || null, req.user.id]
    );
    res.json({ message: "Attendance updated", record: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LEAVE ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/attendance/leaves
router.get("/leaves", auth, async (req, res) => {
  const { status } = req.query;
  try {
    let query, params;
    if (req.user.role === "hr") {
      query = `
        SELECT lr.*,
               u.first_name, u.last_name, u.department, u.employee_id,
               u.email AS employee_email
        FROM leave_requests lr
        JOIN users u ON u.id = lr.user_id
        ${status ? "WHERE lr.status = $1" : ""}
        ORDER BY lr.created_at DESC`;
      params = status ? [status] : [];
    } else {
      query = `
        SELECT * FROM leave_requests
        WHERE user_id = $1
        ${status ? "AND status = $2" : ""}
        ORDER BY created_at DESC`;
      params = status ? [req.user.id, status] : [req.user.id];
    }
    const result = await pool.query(query, params);
    res.json({ leaves: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/attendance/leaves  ── triggers: sendLeaveSubmitted (notify HR)
router.post("/leaves", auth, async (req, res) => {
  const { leave_type, from_date, to_date, reason } = req.body;
  if (!from_date || !to_date)
    return res.status(400).json({ error: "from_date and to_date are required" });

  try {
    const result = await pool.query(
      `INSERT INTO leave_requests (user_id, leave_type, from_date, to_date, reason)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, leave_type || "casual", from_date, to_date, reason || null]
    );
    const leave = result.rows[0];

    // Fetch employee details for email
    const empRes = await pool.query(
      "SELECT first_name, last_name, email FROM users WHERE id = $1",
      [req.user.id]
    );
    if (empRes.rows.length > 0) {
      const emp = empRes.rows[0];
      fireEmail(sendLeaveSubmitted, leave, {
        name:  `${emp.first_name} ${emp.last_name}`,
        email: emp.email,
      });
    }

    res.status(201).json({ message: "Leave request submitted", leave });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/attendance/leaves/:id/review  ── triggers: sendLeaveReviewed (notify employee)
router.put("/leaves/:id/review", auth, hrOnly, async (req, res) => {
  const { status } = req.body;
  if (!["approved", "rejected"].includes(status))
    return res.status(400).json({ error: "status must be approved or rejected" });

  try {
    const result = await pool.query(
      `UPDATE leave_requests
       SET status = $1, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, req.user.id, req.params.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Leave request not found" });

    const leave = result.rows[0];

    // Fetch employee + reviewer for emails
    const empRes = await pool.query(
      "SELECT first_name, last_name, email FROM users WHERE id = $1",
      [leave.user_id]
    );
    const reviewerRes = await pool.query(
      "SELECT first_name, last_name FROM users WHERE id = $1",
      [req.user.id]
    );
    if (empRes.rows.length > 0) {
      const emp      = empRes.rows[0];
      const reviewer = reviewerRes.rows[0];
      fireEmail(sendLeaveReviewed, leave, {
        name:  `${emp.first_name} ${emp.last_name}`,
        email: emp.email,
      }, status, reviewer ? `${reviewer.first_name} ${reviewer.last_name}` : "HR");
    }

    res.json({ message: `Leave ${status}`, leave });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
