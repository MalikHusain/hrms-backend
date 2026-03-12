// utils/mailer.js  (ES Module)

import nodemailer from "nodemailer";

// ─── Lazy transporter — created on each call so .env is already loaded ────────
function getTransporter() {
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "malikhusain004@gmail.com",
      pass: "uycl kzwr dapa kbbl",
    },
  });
}

// ─── Status badge styles ──────────────────────────────────────────────────────
const STATUS_STYLES = {
  applied:     { bg: "#eff6ff", color: "#1d4ed8", label: "Applied"     },
  interviewed: { bg: "#fffbeb", color: "#b45309", label: "Interviewed" },
  offered:     { bg: "#f5f3ff", color: "#6d28d9", label: "Offered"     },
  onboarded:   { bg: "#f0fdf4", color: "#15803d", label: "Onboarded"   },
  rejected:    { bg: "#fef2f2", color: "#b91c1c", label: "Rejected"    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusBadge(status) {
  const s = STATUS_STYLES[status] || { bg: "#f1f5f9", color: "#475569", label: status };
  return `<span style="display:inline-block;padding:4px 12px;border-radius:99px;background:${s.bg};color:${s.color};font-size:12px;font-weight:600;">${s.label}</span>`;
}

function infoRow(label, value) {
  return `
    <tr>
      <td style="padding:8px 0;font-size:13px;color:#64748b;width:130px;vertical-align:top;">${label}</td>
      <td style="padding:8px 0;font-size:13px;color:#0f172a;font-weight:500;">${value || "—"}</td>
    </tr>`;
}

function baseTemplate(title, bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:#1e293b;padding:24px 32px;">
            <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;">HRMS</p>
            <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">Human Resource Management System</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 20px;font-size:20px;font-weight:700;color:#0f172a;">${title}</h2>
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #f1f5f9;background:#f8fafc;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">Automated notification from HRMS. Do not reply.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── 1. New Candidate Added ───────────────────────────────────────────────────
export async function sendCandidateAdded(candidate) {
  const body = `
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
      A new candidate has been registered in the HRMS portal.
    </p>
    <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Name",       candidate.name)}
        ${infoRow("Email",      candidate.email)}
        ${infoRow("Phone",      candidate.phone)}
        ${infoRow("Position",   candidate.position)}
        ${infoRow("Department", candidate.department)}
        ${infoRow("Status",     statusBadge(candidate.status))}
      </table>
    </div>
    <p style="margin:0;font-size:13px;color:#94a3b8;">
      Registered on ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
    </p>`;

  await getTransporter().sendMail({
    from:    process.env.EMAIL_FROM,
    to:      process.env.EMAIL_USER,
    subject: `[HRMS] New Candidate: ${candidate.name} — ${candidate.position || "No position"}`,
    html:    baseTemplate("New Candidate Registered", body),
  });
}

// ─── 2. Status Changed ───────────────────────────────────────────────────────
export async function sendStatusChange(candidate, oldStatus, newStatus) {
  const s = STATUS_STYLES[newStatus] || {};
  const body = `
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
      The application status for <strong style="color:#0f172a;">${candidate.name}</strong> has been updated.
    </p>
    <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Candidate",  candidate.name)}
        ${infoRow("Email",      candidate.email)}
        ${infoRow("Position",   candidate.position)}
        ${infoRow("Previous",   statusBadge(oldStatus))}
        ${infoRow("New Status", statusBadge(newStatus))}
      </table>
    </div>
    <p style="margin:0;font-size:13px;color:#94a3b8;">
      Updated on ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
    </p>`;

  await getTransporter().sendMail({
    from:    process.env.EMAIL_FROM,
    to:      process.env.EMAIL_USER,
    subject: `[HRMS] Status Update: ${candidate.name} → ${s.label || newStatus}`,
    html:    baseTemplate("Candidate Status Updated", body),
  });
}

// ─── 3. Document Uploaded ────────────────────────────────────────────────────
export async function sendDocumentUploaded(candidate, uploadedDocs) {
  const docRows = uploadedDocs.map((doc) => `
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#0f172a;border-bottom:1px solid #f1f5f9;">
        📄 ${doc.name}
      </td>
      <td style="padding:8px 12px;font-size:12px;color:#64748b;border-bottom:1px solid #f1f5f9;text-align:right;">
        ${(doc.size / 1024).toFixed(1)} KB
      </td>
    </tr>`).join("");

  const body = `
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
      New document(s) uploaded for <strong style="color:#0f172a;">${candidate.name}</strong>.
    </p>
    <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Candidate",   candidate.name)}
        ${infoRow("Position",    candidate.position)}
        ${infoRow("Total files", `${(candidate.documents || []).length} on record`)}
      </table>
    </div>
    <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#0f172a;">Newly uploaded:</p>
    <table width="100%" cellpadding="0" cellspacing="0"
      style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <tr style="background:#f8fafc;">
        <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-align:left;">File</th>
        <th style="padding:10px 12px;font-size:11px;font-weight:600;color:#64748b;text-align:right;">Size</th>
      </tr>
      ${docRows}
    </table>
    <p style="margin:16px 0 0;font-size:13px;color:#94a3b8;">
      Uploaded on ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
    </p>`;

  await getTransporter().sendMail({
    from:    process.env.EMAIL_FROM,
    to:      process.env.EMAIL_USER,
    subject: `[HRMS] Document Upload: ${candidate.name} — ${uploadedDocs.length} new file(s)`,
    html:    baseTemplate("Documents Uploaded", body),
  });
}

// ─── 4. Leave Submitted — notify HR ──────────────────────────────────────────
export async function sendLeaveSubmitted(leave, employee) {
  const body = `
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
      A new leave request has been submitted and requires your review.
    </p>
    <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#64748b;width:130px;">Employee</td>
          <td style="padding:8px 0;font-size:13px;color:#0f172a;font-weight:500;">${employee.name}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#64748b;">Email</td>
          <td style="padding:8px 0;font-size:13px;color:#0f172a;font-weight:500;">${employee.email}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#64748b;">Leave Type</td>
          <td style="padding:8px 0;font-size:13px;color:#0f172a;font-weight:500;text-transform:capitalize;">${leave.leave_type}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#64748b;">From</td>
          <td style="padding:8px 0;font-size:13px;color:#0f172a;font-weight:500;">${new Date(leave.from_date).toLocaleDateString("en-IN", { dateStyle: "medium" })}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#64748b;">To</td>
          <td style="padding:8px 0;font-size:13px;color:#0f172a;font-weight:500;">${new Date(leave.to_date).toLocaleDateString("en-IN", { dateStyle: "medium" })}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#64748b;vertical-align:top;">Reason</td>
          <td style="padding:8px 0;font-size:13px;color:#0f172a;font-weight:500;">${leave.reason || "—"}</td>
        </tr>
      </table>
    </div>
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:16px;margin-bottom:20px;">
      <p style="margin:0;font-size:13px;color:#b45309;">
        ⏳ <strong>Action required:</strong> Log in to HRMS to approve or reject this request.
      </p>
    </div>
    <p style="margin:0;font-size:13px;color:#94a3b8;">
      Submitted on ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
    </p>`;

  await getTransporter().sendMail({
    from:    "malikhusain004@gmail.com",
    to:      "malikhusain004@gmail.com",
    subject: `[HRMS] Leave Request: ${employee.name} — ${leave.leave_type} (${new Date(leave.from_date).toLocaleDateString("en-IN")})`,
    html:    baseTemplate("New Leave Request", body),
  });
}

// ─── 5. Leave Reviewed — notify employee ──────────────────────────────────────
export async function sendLeaveReviewed(leave, employee, status, reviewerName) {
  const approved = status === "approved";
  const color    = approved ? "#15803d" : "#b91c1c";
  const bg       = approved ? "#f0fdf4" : "#fef2f2";
  const border   = approved ? "#bbf7d0" : "#fecaca";
  const icon     = approved ? "✅" : "❌";

  const body = `
    <p style="margin:0 0 20px;font-size:14px;color:#475569;line-height:1.6;">
      Hi <strong style="color:#0f172a;">${employee.name}</strong>, your leave request has been reviewed.
    </p>
    <div style="background:${bg};border:1px solid ${border};border-radius:12px;padding:16px;margin-bottom:20px;">
      <p style="margin:0;font-size:14px;color:${color};font-weight:600;">
        ${icon} Your leave has been <strong>${status.toUpperCase()}</strong>
      </p>
    </div>
    <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:20px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#64748b;width:130px;">Leave Type</td>
          <td style="padding:8px 0;font-size:13px;color:#0f172a;font-weight:500;text-transform:capitalize;">${leave.leave_type}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#64748b;">From</td>
          <td style="padding:8px 0;font-size:13px;color:#0f172a;font-weight:500;">${new Date(leave.from_date).toLocaleDateString("en-IN", { dateStyle: "medium" })}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#64748b;">To</td>
          <td style="padding:8px 0;font-size:13px;color:#0f172a;font-weight:500;">${new Date(leave.to_date).toLocaleDateString("en-IN", { dateStyle: "medium" })}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#64748b;">Reviewed by</td>
          <td style="padding:8px 0;font-size:13px;color:#0f172a;font-weight:500;">${reviewerName}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;font-size:13px;color:#64748b;">Decision</td>
          <td style="padding:8px 0;font-size:13px;color:${color};font-weight:600;text-transform:capitalize;">${status}</td>
        </tr>
      </table>
    </div>
    <p style="margin:0;font-size:13px;color:#94a3b8;">
      Reviewed on ${new Date().toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
    </p>`;

  await getTransporter().sendMail({
    from:    "malikhusain004@gmail.com",
    to:      employee.email,
    subject: `[HRMS] Leave ${approved ? "Approved" : "Rejected"}: ${leave.leave_type} — ${new Date(leave.from_date).toLocaleDateString("en-IN")}`,
    html:    baseTemplate("Leave Request Update", body),
  });
}
