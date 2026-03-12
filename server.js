import express  from "express";
import cors     from "cors";
import bcrypt   from "bcryptjs";
import jwt      from "jsonwebtoken";
import dotenv   from "dotenv";
import pool     from "./db.js";                          // ← pool lives here now
import attendanceRoutes from "./routes/attendance.js";
import candidateRoutes from "./routes/candidates.js";
import { encrypt, decrypt } from "./utils/crypto.js";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/attendance", attendanceRoutes);
app.use("/api/candidates", candidateRoutes);
app.use("/uploads", express.static("uploads"));

// POST /api/auth/register  ── encrypts email + phone before storing
app.post("/api/auth/register", async (req, res) => {
  const { first_name, last_name, email, password, role, phone, department, employee_id } = req.body;
  if (!email || !password || !first_name || !last_name)
    return res.status(400).json({ error: "first_name, last_name, email and password are required" });

  try {
    const hashed = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users
         (first_name, last_name, email, password, role, phone, department, employee_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, first_name, last_name, email, role, department, employee_id`,
      [
        first_name,
        last_name,
        encrypt(email),        // ← encrypted
        hashed,
        role       || "employee",
        encrypt(phone) || null,// ← encrypted
        department || null,
        employee_id || null,
      ]
    );

    const user  = result.rows[0];
    user.email  = decrypt(user.email);  // decrypt for the JWT payload + response
    user.phone  = decrypt(user.phone);

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET || "hrms_secret",
      { expiresIn: "7d" }
    );

    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    if (err.code === "23505") return res.status(400).json({ error: "Email already registered" });
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/auth/login  ── must compare against encrypted email in DB
app.post("/api/auth/login", async (req, res) => {
  const { email, employee_id, password } = req.body;
if ((!email && !employee_id) || !password)
  return res.status(400).json({ error: "credentials and password are required" });

  try {
    // Fetch all users and find the one whose decrypted email matches
    // (needed because AES-GCM uses random IV — same plaintext encrypts differently each time)
    const all = await pool.query(
      "SELECT id, first_name, last_name, email, password, role, phone, department, employee_id FROM users"
    );

    const user = all.rows.find(u => {
  try {
    if (employee_id) return u.employee_id === employee_id;
    return decrypt(u.email) === email;
  } catch { return false; }
});
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid email or password" });

    // Decrypt PII for response + token
    const decryptedEmail = decrypt(user.email);
    const decryptedPhone = decrypt(user.phone);

    const token = jwt.sign(
      { id: user.id, role: user.role, email: decryptedEmail },
      process.env.JWT_SECRET || "hrms_secret",
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id:          user.id,
        first_name:  user.first_name,
        last_name:   user.last_name,
        email:       decryptedEmail,
        phone:       decryptedPhone,
        role:        user.role,
        department:  user.department,
        employee_id: user.employee_id,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
}); 

/* ================= START SERVER ================= */

app.listen(5000, () =>
  console.log("Server running on http://localhost:5000")
);
