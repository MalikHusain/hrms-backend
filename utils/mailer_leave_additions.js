// ─────────────────────────────────────────────────────────────────────────────
// PASTE THESE TWO FUNCTIONS AT THE BOTTOM OF utils/mailer.js
// ─────────────────────────────────────────────────────────────────────────────

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
