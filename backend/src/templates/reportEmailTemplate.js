// Clean HTML email template for client report delivery messages.

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function money(value) {
    const parsed = Number(value || 0);
    return parsed.toLocaleString(undefined, {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    });
}

function number(value) {
    return Number(value || 0).toLocaleString();
}

export function buildReportEmailTemplate({
    recipientName,
    senderName,
    reportTitle,
    clientName,
    from,
    to,
    summary = {},
    note,
}) {
    const safeRecipientName = escapeHtml(recipientName || 'there');
    const safeSenderName = escapeHtml(senderName || 'CloudCRM');
    const safeReportTitle = escapeHtml(reportTitle || 'Performance Report');
    const safeClientName = escapeHtml(clientName || 'All Clients');
    const safeNote = note ? escapeHtml(note) : '';

    const metrics = [
        { label: 'Spend', value: money(summary.spend) },
        { label: 'Revenue', value: money(summary.revenue) },
        { label: 'Leads', value: number(summary.leads) },
        { label: 'ROAS', value: `${Number(summary.roas || 0).toFixed(2)}x` },
    ];

    return `
<!doctype html>
<html>
  <body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#111827;padding:24px 28px;">
                <div style="font-size:13px;font-weight:700;color:#c7d2fe;letter-spacing:.08em;text-transform:uppercase;">CloudCRM Report</div>
                <h1 style="margin:10px 0 0;font-size:24px;line-height:1.25;color:#ffffff;">${safeReportTitle}</h1>
                <p style="margin:8px 0 0;font-size:13px;color:#cbd5e1;">${safeClientName} &bull; ${escapeHtml(from)} to ${escapeHtml(to)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 28px 8px;">
                <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Hi ${safeRecipientName},</p>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.6;">${safeSenderName} sent you the latest client performance report. The full PDF is attached to this email.</p>
                ${safeNote ? `<p style="margin:0 0 18px;padding:12px 14px;background:#f8fafc;border-left:3px solid #6366f1;font-size:14px;line-height:1.5;color:#334155;">${safeNote}</p>` : ''}
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 22px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    ${metrics.map(metric => `
                      <td style="width:25%;padding:8px;">
                        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:#ffffff;">
                          <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;">${metric.label}</div>
                          <div style="margin-top:6px;font-size:17px;font-weight:700;color:#0f172a;">${metric.value}</div>
                        </div>
                      </td>
                    `).join('')}
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 26px;border-top:1px solid #e2e8f0;background:#f8fafc;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">This automated message was sent from CloudCRM. Please review the attached PDF for campaign-level details.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
