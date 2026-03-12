const express = require("express");
const router  = express.Router();
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const pool    = require("../db"); // your pg pool

// ── Register ──────────────────────────────────────────
router.post("/register", async (req, res) => {
  const { first_name, last_name, email, phone, password, role, department, employee_id } = req.body;

  try {
    // Check if user exists
    const exists = await pool.query(
      "SELECT id FROM users WHERE email = $1", [email]
    );
    if (exists.rows.length > 0)
      return res.status(400).json({ error: "Email already registered" });

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(
      `INSERT INTO users 
        (first_name, last_name, email, phone, password, role, department, employee_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, first_name, last_name, email, role`,
      [first_name, last_name, email, phone, hashed, role, department, employee_id]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Login ─────────────────────────────────────────────
router.post("/login", async (req, res) => {
  const { email, employee_id, password, role } = req.body;

  try {
    // Find by email or employee_id depending on role
    let result;
    if (role === "employee") {
      result = await pool.query(
        "SELECT * FROM users WHERE employee_id = $1 AND role = $2",
        [employee_id, role]
      );
    } else {
      result = await pool.query(
        "SELECT * FROM users WHERE email = $1 AND role = $2",
        [email, role]
      );
    }

    if (result.rows.length === 0)
      return res.status(401).json({ error: "Invalid credentials" });

    const user = result.rows[0];

    // Check password
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(401).json({ error: "Invalid credentials" });

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id:         user.id,
        first_name: user.first_name,
        last_name:  user.last_name,
        email:      user.email,
        role:       user.role,
        department: user.department,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;