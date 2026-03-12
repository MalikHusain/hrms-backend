// routes/candidates.js  (ES Module)
import express  from "express";
import jwt      from "jsonwebtoken";
import multer   from "multer";
import path     from "path";
import fs       from "fs";
import pool     from "../db.js";
import { encrypt, decrypt, decryptRow, decryptRows } from "../utils/crypto.js";
import {
  sendStatusChange,
  sendCandidateAdded,
  sendDocumentUploaded,
} from "../utils/mailer.js";

const router = express.Router();

// ─── Auth ─────────────────────────────────────────────────────────────────────
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

// ─── Multer ───────────────────────────────────────────────────────────────────
const UPLOAD_DIR = "./uploads/candidates";
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => {
    const safe = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".pdf", ".doc", ".docx", ".jpg", ".jpeg", ".png"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`File type ${ext} not allowed`));
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/candidates
// Note: search by email/phone won't match encrypted values — search by name/position only
router.get("/", auth, async (req, res) => {
  const { status, search } = req.query;
  try {
    let query  = "SELECT * FROM candidates";
    const params = [], where = [];

    if (status && status !== "all") {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      // Search only unencrypted fields
      where.push(`(name ILIKE $${params.length} OR position ILIKE $${params.length} OR department ILIKE $${params.length})`);
    }
    if (where.length) query += " WHERE " + where.join(" AND ");
    query += " ORDER BY applied_date DESC";

    const result = await pool.query(query, params);
    // Decrypt PII before sending to frontend
    res.json({ candidates: decryptRows(result.rows) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/candidates/:id
router.get("/:id", auth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM candidates WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: "Candidate not found" });
    res.json({ candidate: decryptRow(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/candidates  ── encrypts email + phone, triggers sendCandidateAdded
router.post("/", auth, hrOnly, upload.array("documents", 5), async (req, res) => {
  const { name, email, phone, position, department, status, notes } = req.body;
  if (!name || !email) return res.status(400).json({ error: "name and email are required" });

  try {
    const documents = (req.files || []).map(f => ({
      name:        f.originalname,
      path:        f.path.replace(/\\/g, "/"),
      size:        f.size,
      mimetype:    f.mimetype,
      uploaded_at: new Date().toISOString(),
    }));

    const result = await pool.query(
      `INSERT INTO candidates
         (name, email, phone, position, department, status, notes, documents)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        name,
        encrypt(email),        // ← encrypted
        encrypt(phone) || null,// ← encrypted
        position  || null,
        department || null,
        status    || "applied",
        notes     || null,
        JSON.stringify(documents),
      ]
    );

    const candidate = decryptRow(result.rows[0]);
    fireEmail(sendCandidateAdded, candidate);
    res.status(201).json({ candidate });
  } catch (err) {
    console.error(err);
    if (err.code === "23505") return res.status(400).json({ error: "Email already exists" });
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/candidates/:id
router.put("/:id", auth, hrOnly, async (req, res) => {
  const { name, email, phone, position, department, status, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE candidates SET
         name=$1, email=$2, phone=$3, position=$4,
         department=$5, status=$6, notes=$7, updated_at=NOW()
       WHERE id=$8 RETURNING *`,
      [
        name,
        encrypt(email),
        encrypt(phone) || null,
        position   || null,
        department || null,
        status,
        notes || null,
        req.params.id,
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Candidate not found" });
    res.json({ candidate: decryptRow(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/candidates/:id/status  ── triggers sendStatusChange
router.patch("/:id/status", auth, hrOnly, async (req, res) => {
  const { status } = req.body;
  const valid = ["applied","interviewed","offered","onboarded","rejected"];
  if (!valid.includes(status)) return res.status(400).json({ error: "Invalid status" });

  try {
    const old = await pool.query("SELECT * FROM candidates WHERE id=$1", [req.params.id]);
    if (old.rows.length === 0) return res.status(404).json({ error: "Candidate not found" });
    const oldStatus = old.rows[0].status;

    const result = await pool.query(
      "UPDATE candidates SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
      [status, req.params.id]
    );

    const candidate = decryptRow(result.rows[0]);
    if (oldStatus !== status) fireEmail(sendStatusChange, candidate, oldStatus, status);
    res.json({ candidate });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/candidates/:id/documents  ── triggers sendDocumentUploaded
router.post("/:id/documents", auth, hrOnly, upload.array("documents", 5), async (req, res) => {
  if (!req.files || req.files.length === 0)
    return res.status(400).json({ error: "No files uploaded" });

  try {
    const existing = await pool.query("SELECT * FROM candidates WHERE id=$1", [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: "Candidate not found" });

    const oldDocs = existing.rows[0].documents || [];
    const newDocs = req.files.map(f => ({
      name:        f.originalname,
      path:        f.path.replace(/\\/g, "/"),
      size:        f.size,
      mimetype:    f.mimetype,
      uploaded_at: new Date().toISOString(),
    }));

    const result = await pool.query(
      "UPDATE candidates SET documents=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
      [JSON.stringify([...oldDocs, ...newDocs]), req.params.id]
    );

    const candidate = decryptRow(result.rows[0]);
    fireEmail(sendDocumentUploaded, candidate, newDocs);
    res.json({ candidate, uploaded: newDocs.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/candidates/:id/documents/:docIndex
router.delete("/:id/documents/:docIndex", auth, hrOnly, async (req, res) => {
  try {
    const existing = await pool.query("SELECT documents FROM candidates WHERE id=$1", [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: "Candidate not found" });

    const docs  = existing.rows[0].documents || [];
    const index = parseInt(req.params.docIndex, 10);
    if (index < 0 || index >= docs.length) return res.status(400).json({ error: "Invalid index" });

    const filePath = docs[index].path;
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    docs.splice(index, 1);

    const result = await pool.query(
      "UPDATE candidates SET documents=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
      [JSON.stringify(docs), req.params.id]
    );
    res.json({ candidate: decryptRow(result.rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/candidates/:id
router.delete("/:id", auth, hrOnly, async (req, res) => {
  try {
    const existing = await pool.query("SELECT documents FROM candidates WHERE id=$1", [req.params.id]);
    if (existing.rows.length > 0) {
      (existing.rows[0].documents || []).forEach(doc => {
        if (fs.existsSync(doc.path)) fs.unlinkSync(doc.path);
      });
    }
    await pool.query("DELETE FROM candidates WHERE id=$1", [req.params.id]);
    res.json({ message: "Candidate deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ─── Multer error handler ─────────────────────────────────────────────────────
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE")
      return res.status(400).json({ error: "File too large. Max 10 MB." });
    return res.status(400).json({ error: err.message });
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
});

export default router;
