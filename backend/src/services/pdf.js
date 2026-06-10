// Builds downloadable and attachable PDF report documents for CloudCRM reports.
import PDFDocument from 'pdfkit';
import { query } from './db.js';

const COLORS = {
    ink: '#0F172A',
    slate: '#334155',
    muted: '#64748B',
    faint: '#94A3B8',
    line: '#E2E8F0',
    soft: '#F8FAFC',
    indigo: '#6366F1',
    purple: '#8B5CF6',
    pink: '#EC4899',
    cyan: '#06B6D4',
    green: '#10B981',
    amber: '#F59E0B',
    dark: '#111827',
};

const CHART_COLORS = [COLORS.indigo, COLORS.pink, COLORS.cyan, COLORS.green, COLORS.amber, COLORS.purple];

function asNumber(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
}

function money(value, digits = 2) {
    return `$${asNumber(value).toLocaleString(undefined, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    })}`;
}

function compactMoney(value) {
    const n = asNumber(value);
    if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}K`;
    return money(n, 0);
}

function count(value) {
    return asNumber(value).toLocaleString();
}

function ratio(numerator, denominator) {
    return asNumber(denominator) > 0 ? asNumber(numerator) / asNumber(denominator) : 0;
}

function pct(numerator, denominator) {
    return ratio(numerator, denominator) * 100;
}

function labelizePlatform(platform = '') {
    return String(platform)
        .replace('_ads', '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, char => char.toUpperCase());
}

function safeFileName(value) {
    return String(value || 'client').replace(/[^a-zA-Z0-9]/g, '_');
}

function pageMetrics(doc) {
    return {
        left: doc.page.margins.left,
        top: doc.page.margins.top,
        right: doc.page.width - doc.page.margins.right,
        bottom: doc.page.height - doc.page.margins.bottom,
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        height: doc.page.height - doc.page.margins.top - doc.page.margins.bottom,
    };
}

function text(doc, value, x, y, options = {}) {
    doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(options.size || 9)
        .fillColor(options.color || COLORS.slate)
        .text(String(value ?? ''), x, y, {
            width: options.width,
            align: options.align,
            lineGap: options.lineGap,
            ellipsis: options.ellipsis,
            lineBreak: false,
        });
}

function drawHeader(doc, title, subtitle) {
    const p = pageMetrics(doc);
    doc.rect(0, 0, doc.page.width, 54).fill(COLORS.dark);
    text(doc, 'CloudCRM', p.left, 18, { size: 15, bold: true, color: '#FFFFFF' });
    text(doc, title, p.right - 260, 18, { size: 10, bold: true, color: '#CBD5E1', width: 260, align: 'right' });
    if (subtitle) {
        text(doc, subtitle, p.right - 260, 33, { size: 7.5, color: '#94A3B8', width: 260, align: 'right' });
    }
}

function sectionTitle(doc, title, x, y, width) {
    text(doc, title, x, y, { size: 15, bold: true, color: COLORS.ink, width });
    doc.roundedRect(x, y + 25, 34, 3, 1.5).fill(COLORS.indigo);
}

function card(doc, x, y, w, h, options = {}) {
    doc.roundedRect(x, y, w, h, 8).fillAndStroke(options.fill || '#FFFFFF', options.stroke || COLORS.line);
}

function metricCard(doc, metric, x, y, w, h, color = COLORS.indigo) {
    card(doc, x, y, w, h);
    doc.roundedRect(x, y, w, 4, 2).fill(color);
    text(doc, metric.label.toUpperCase(), x + 12, y + 14, { size: 7.5, bold: true, color: COLORS.muted, width: w - 24 });
    text(doc, metric.value, x + 12, y + 32, { size: 17, bold: true, color: COLORS.ink, width: w - 24 });
    if (metric.sub) {
        text(doc, metric.sub, x + 12, y + 56, { size: 7.5, color: COLORS.faint, width: w - 24 });
    }
}

function drawMetricGrid(doc, metrics, x, y, width) {
    const gap = 12;
    const cols = 4;
    const cardW = (width - gap * (cols - 1)) / cols;
    const cardH = 82;

    metrics.forEach((metric, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        metricCard(
            doc,
            metric,
            x + col * (cardW + gap),
            y + row * (cardH + gap),
            cardW,
            cardH,
            CHART_COLORS[index % CHART_COLORS.length],
        );
    });

    return y + Math.ceil(metrics.length / cols) * cardH + (Math.ceil(metrics.length / cols) - 1) * gap;
}

function drawHorizontalBars(doc, title, rows, valueKey, x, y, w, h, formatter = count) {
    card(doc, x, y, w, h);
    text(doc, title, x + 16, y + 14, { size: 12, bold: true, color: COLORS.ink, width: w - 32 });

    const plotTop = y + 48;
    const labelW = Math.min(168, w * 0.34);
    const valueW = 66;
    const barX = x + 16 + labelW;
    const barW = w - 44 - labelW - valueW;
    const max = Math.max(...rows.map(row => asNumber(row[valueKey])), 1);
    const visibleRows = rows.slice(0, 7);
    const rowH = Math.min(30, (h - 66) / Math.max(visibleRows.length, 1));

    visibleRows.forEach((row, index) => {
        const yy = plotTop + index * rowH;
        const value = asNumber(row[valueKey]);
        const filledW = Math.max(3, (value / max) * barW);
        text(doc, row.label, x + 16, yy + 1, { size: 8, color: COLORS.slate, width: labelW - 10, ellipsis: true });
        doc.roundedRect(barX, yy + 3, barW, 10, 5).fill('#EEF2F7');
        doc.roundedRect(barX, yy + 3, filledW, 10, 5).fill(CHART_COLORS[index % CHART_COLORS.length]);
        text(doc, formatter(value), barX + barW + 10, yy, { size: 8, color: COLORS.muted, width: valueW, align: 'right' });
    });
}

function drawGroupedBars(doc, title, rows, keys, x, y, w, h) {
    card(doc, x, y, w, h);
    text(doc, title, x + 16, y + 14, { size: 12, bold: true, color: COLORS.ink, width: w - 32 });

    const plotX = x + 42;
    const plotY = y + 50;
    const plotW = w - 70;
    const plotH = h - 92;
    const max = Math.max(...rows.flatMap(row => keys.map(key => asNumber(row[key.id]))), 1);

    doc.strokeColor('#EEF2F7').lineWidth(0.6);
    for (let i = 0; i <= 4; i += 1) {
        const yy = plotY + (plotH / 4) * i;
        doc.moveTo(plotX, yy).lineTo(plotX + plotW, yy).stroke();
    }

    const groupW = plotW / Math.max(rows.length, 1);
    const barW = Math.min(16, (groupW - 18) / keys.length);

    rows.forEach((row, rowIndex) => {
        const baseX = plotX + rowIndex * groupW + (groupW - keys.length * barW) / 2;
        keys.forEach((key, keyIndex) => {
            const value = asNumber(row[key.id]);
            const barH = (value / max) * plotH;
            doc.roundedRect(baseX + keyIndex * barW, plotY + plotH - barH, barW - 2, barH, 2).fill(key.color);
        });
        text(doc, row.label, plotX + rowIndex * groupW, plotY + plotH + 9, { size: 7.2, color: COLORS.muted, width: groupW, align: 'center', ellipsis: true });
    });

    keys.forEach((key, index) => {
        const lx = x + 16 + index * 112;
        doc.circle(lx + 4, y + h - 20, 4).fill(key.color);
        text(doc, key.label, lx + 13, y + h - 24, { size: 7.5, color: COLORS.muted, width: 94 });
    });
}

function drawDonut(doc, title, rows, x, y, w, h) {
    card(doc, x, y, w, h);
    text(doc, title, x + 16, y + 14, { size: 12, bold: true, color: COLORS.ink, width: w - 32 });

    const total = rows.reduce((sum, row) => sum + asNumber(row.spend), 0) || 1;
    text(doc, compactMoney(total), x + 16, y + 42, { size: 24, bold: true, color: COLORS.ink, width: w - 32 });
    text(doc, 'total spend', x + 18, y + 75, { size: 8, bold: true, color: COLORS.faint, width: w - 36 });

    const barX = x + 16;
    const barY = y + 104;
    const barW = w - 32;
    const barH = 16;
    let offset = 0;
    doc.roundedRect(barX, barY, barW, barH, 8).fill('#EEF2F7');

    rows.forEach((row, index) => {
        const segmentW = (asNumber(row.spend) / total) * barW;
        if (segmentW > 0) {
            doc.rect(barX + offset, barY, segmentW, barH).fill(CHART_COLORS[index % CHART_COLORS.length]);
        }
        offset += segmentW;
    });
    doc.roundedRect(barX, barY, barW, barH, 8).stroke(COLORS.line);

    rows.forEach((row, index) => {
        const yy = y + 142 + index * 19;
        const share = (asNumber(row.spend) / total) * 100;
        doc.circle(x + 18, yy + 4, 4).fill(CHART_COLORS[index % CHART_COLORS.length]);
        text(doc, row.label, x + 30, yy, { size: 8, color: COLORS.slate, width: 116, ellipsis: true });
        text(doc, money(row.spend), x + 146, yy, { size: 8, color: COLORS.muted, width: 62, align: 'right' });
        text(doc, `${share.toFixed(1)}%`, x + w - 62, yy, { size: 8, bold: true, color: COLORS.ink, width: 42, align: 'right' });
    });
}

function drawFunnel(doc, metrics, x, y, w, h) {
    card(doc, x, y, w, h);
    text(doc, 'Conversion Funnel', x + 16, y + 14, { size: 12, bold: true, color: COLORS.ink, width: w - 32 });
    const steps = [
        { label: 'Impressions', value: metrics.impressions, sub: `${metrics.ctr.toFixed(2)}% CTR` },
        { label: 'Clicks', value: metrics.clicks, sub: `${metrics.leadRate.toFixed(2)}% click-to-lead` },
        { label: 'Leads', value: metrics.leads, sub: `${money(metrics.cpl)} CPL` },
        { label: 'Conversions', value: metrics.conversions, sub: `${metrics.conversionRate.toFixed(2)}% click-to-conv.` },
    ];
    const gap = 11;
    const stepW = (w - 32 - gap * 3) / 4;
    steps.forEach((step, index) => {
        const xx = x + 16 + index * (stepW + gap);
        doc.roundedRect(xx, y + 54, stepW, h - 76, 8).fillAndStroke(COLORS.soft, COLORS.line);
        text(doc, step.label.toUpperCase(), xx + 10, y + 69, { size: 7, bold: true, color: COLORS.muted, width: stepW - 20 });
        text(doc, count(step.value), xx + 10, y + 88, { size: 15, bold: true, color: COLORS.ink, width: stepW - 20 });
        text(doc, step.sub, xx + 10, y + 113, { size: 7.5, color: COLORS.faint, width: stepW - 20 });
    });
}

function drawTable(doc, title, columns, rows, x, y, w, rowH = 24) {
    text(doc, title, x, y, { size: 14, bold: true, color: COLORS.ink, width: w });
    y += 28;

    doc.roundedRect(x, y, w, 28, 6).fill('#F1F5F9');
    columns.forEach(col => {
        text(doc, col.label.toUpperCase(), x + col.x, y + 10, {
            size: 6.8,
            bold: true,
            color: COLORS.muted,
            width: col.w,
            align: col.align,
        });
    });
    y += 30;

    rows.forEach((row, index) => {
        if (index % 2 === 0) doc.rect(x, y, w, rowH).fill('#FCFCFD');
        columns.forEach(col => {
            text(doc, col.value(row), x + col.x, y + 7, {
                size: 7.4,
                color: col.color ? col.color(row) : COLORS.slate,
                bold: col.bold,
                width: col.w,
                align: col.align,
                ellipsis: true,
            });
        });
        doc.strokeColor('#F1F5F9').lineWidth(0.5).moveTo(x, y + rowH).lineTo(x + w, y + rowH).stroke();
        y += rowH;
    });
}

function normalizePlatformRows(rows) {
    return rows.map(row => {
        const spend = asNumber(row.spend);
        const revenue = asNumber(row.revenue);
        const clicks = asNumber(row.clicks);
        const impressions = asNumber(row.impressions);
        const leads = asNumber(row.leads);
        const conversions = asNumber(row.conversions);

        return {
            ...row,
            label: labelizePlatform(row.platform),
            spend,
            revenue,
            clicks,
            impressions,
            leads,
            conversions,
            roas: ratio(revenue, spend),
            cpl: ratio(spend, leads),
            cpc: ratio(spend, clicks),
            ctr: pct(clicks, impressions),
            conversionRate: pct(conversions, clicks),
        };
    });
}

function normalizeCampaignRows(rows) {
    return rows.map(row => {
        const spend = asNumber(row.spend);
        const revenue = asNumber(row.revenue);
        const clicks = asNumber(row.clicks);
        const impressions = asNumber(row.impressions);
        const leads = asNumber(row.leads);
        const conversions = asNumber(row.conversions);

        return {
            ...row,
            label: row.campaign_name,
            platformLabel: labelizePlatform(row.platform),
            spend,
            revenue,
            clicks,
            impressions,
            leads,
            conversions,
            roas: ratio(revenue, spend),
            cpl: ratio(spend, leads),
            ctr: pct(clicks, impressions),
            conversionRate: pct(conversions, clicks),
        };
    });
}

/**
 * Render a PDF performance report and let the caller decide where it streams.
 * @param {string|null} clientId
 * @param {string} from  ISO date string
 * @param {string} to    ISO date string
 * @param {object} options
 * @param {(doc: PDFDocument, meta: object) => void} attachDocument
 */
async function renderClientReportPdf(clientId, from, to, options = {}, attachDocument) {
    const reportTitle = options.title || 'Performance Report';
    const scope = options.scope || {};
    const isSingleClient = Boolean(clientId);
    let client = {
        name: options.clientName || 'All Clients',
        industry: 'Agency Portfolio',
        monthly_budget: 0,
    };

    if (isSingleClient) {
        const clientResult = await query('SELECT name, industry, monthly_budget FROM clients WHERE id = $1 AND is_active = true', [clientId]);
        if (clientResult.rows.length === 0) {
            throw new Error('Client not found');
        }
        client = clientResult.rows[0];
    }

    const scopedClientIds = Array.isArray(scope.assignedClientIds) ? scope.assignedClientIds : [];
    const baseParams = [from, to];
    const metricWhere = ['date >= $1', 'date <= $2'];
    const cmWhere = ['cm.date >= $1', 'cm.date <= $2'];
    const campaignWhere = [];

    if (isSingleClient) {
        baseParams.push(clientId);
        metricWhere.push(`client_id = $${baseParams.length}`);
        cmWhere.push(`cm.client_id = $${baseParams.length}`);
        campaignWhere.push(`c.client_id = $${baseParams.length}`);
    } else if (scope.role === 'manager' || scope.role === 'employee') {
        if (scopedClientIds.length === 0) {
            baseParams.push([]);
            metricWhere.push(`client_id = ANY($${baseParams.length}::uuid[])`);
            cmWhere.push(`cm.client_id = ANY($${baseParams.length}::uuid[])`);
            campaignWhere.push(`c.client_id = ANY($${baseParams.length}::uuid[])`);
        } else {
            baseParams.push(scopedClientIds);
            metricWhere.push(`client_id = ANY($${baseParams.length}::uuid[])`);
            cmWhere.push(`cm.client_id = ANY($${baseParams.length}::uuid[])`);
            campaignWhere.push(`c.client_id = ANY($${baseParams.length}::uuid[])`);
        }
    } else if (scope.role === 'client') {
        baseParams.push(scope.clientId);
        metricWhere.push(`client_id = $${baseParams.length}`);
        cmWhere.push(`cm.client_id = $${baseParams.length}`);
        campaignWhere.push(`c.client_id = $${baseParams.length}`);
    }

    const metricsResult = await query(
        `SELECT
       COALESCE(SUM(spend), 0)       AS total_spend,
       COALESCE(SUM(leads), 0)       AS total_leads,
       COALESCE(SUM(reach), 0)       AS total_reach,
       COALESCE(SUM(impressions), 0) AS total_impressions,
       COALESCE(SUM(clicks), 0)      AS total_clicks,
       COALESCE(SUM(conversions), 0) AS total_conversions,
       COALESCE(SUM(revenue), 0)     AS total_revenue
     FROM campaign_metrics
     WHERE ${metricWhere.join(' AND ')}`,
        baseParams
    );
    const m = metricsResult.rows[0];

    const platformResult = await query(
        `SELECT
            cm.source AS platform,
            COALESCE(SUM(cm.spend), 0) AS spend,
            COALESCE(SUM(cm.impressions), 0) AS impressions,
            COALESCE(SUM(cm.clicks), 0) AS clicks,
            COALESCE(SUM(cm.leads), 0) AS leads,
            COALESCE(SUM(cm.conversions), 0) AS conversions,
            COALESCE(SUM(cm.revenue), 0) AS revenue
     FROM campaign_metrics cm
     WHERE ${cmWhere.join(' AND ')}
     GROUP BY cm.source
     ORDER BY spend DESC`,
        baseParams
    );

    const campaignResult = await query(
        `SELECT c.name AS campaign_name, c.platform, c.status,
            COALESCE(SUM(cm.spend), 0) AS spend,
            COALESCE(SUM(cm.impressions), 0) AS impressions,
            COALESCE(SUM(cm.leads), 0) AS leads,
            COALESCE(SUM(cm.clicks), 0) AS clicks,
            COALESCE(SUM(cm.conversions), 0) AS conversions,
            COALESCE(SUM(cm.revenue), 0) AS revenue
     FROM campaigns c
     LEFT JOIN campaign_metrics cm ON cm.campaign_id = c.id AND cm.date >= $1 AND cm.date <= $2
     ${campaignWhere.length > 0 ? `WHERE ${campaignWhere.join(' AND ')}` : ''}
     GROUP BY c.id, c.name, c.platform, c.status
     ORDER BY spend DESC`,
        baseParams
    );

    const totalSpend = asNumber(m.total_spend);
    const totalRevenue = asNumber(m.total_revenue);
    const totalImpressions = asNumber(m.total_impressions);
    const totalClicks = asNumber(m.total_clicks);
    const totalLeads = asNumber(m.total_leads);
    const totalConversions = asNumber(m.total_conversions);
    const summary = {
        spend: totalSpend,
        revenue: totalRevenue,
        impressions: totalImpressions,
        clicks: totalClicks,
        leads: totalLeads,
        conversions: totalConversions,
        reach: asNumber(m.total_reach),
        roas: ratio(totalRevenue, totalSpend),
        ctr: pct(totalClicks, totalImpressions),
        cpc: ratio(totalSpend, totalClicks),
        cpl: ratio(totalSpend, totalLeads),
        conversionRate: pct(totalConversions, totalClicks),
        leadRate: pct(totalLeads, totalClicks),
    };

    const platformRows = normalizePlatformRows(platformResult.rows);
    const campaignRows = normalizeCampaignRows(campaignResult.rows);
    const p = { left: 36, top: 36, width: 769.89 };

    const doc = new PDFDocument({
        margins: { top: 36, left: 36, right: 36, bottom: 15 },
        size: 'A4',
        layout: 'landscape',
    });

    const filename = `${safeFileName(client.name)}_${safeFileName(reportTitle)}.pdf`;
    attachDocument(doc, { filename, client, summary });

    // Cover
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLORS.dark);
    doc.roundedRect(48, 48, 44, 44, 9).fill(COLORS.indigo);
    text(doc, 'CRM', 57, 63, { size: 13, bold: true, color: '#FFFFFF' });
    text(doc, reportTitle, 48, 136, { size: 34, bold: true, color: '#FFFFFF', width: 520 });
    text(doc, client.name, 50, 188, { size: 18, color: '#C7D2FE', width: 460 });
    text(doc, `${from} to ${to}`, 50, 218, { size: 11, color: '#CBD5E1', width: 460 });
    text(doc, isSingleClient ? `Industry: ${client.industry || 'N/A'}   Monthly Budget: ${money(client.monthly_budget, 0)}` : 'Scoped portfolio report', 50, 242, { size: 10, color: '#94A3B8', width: 560 });
    doc.roundedRect(50, 310, 188, 86, 10).fill('#1F2937');
    text(doc, 'Total Spend', 68, 330, { size: 8, bold: true, color: '#94A3B8' });
    text(doc, money(summary.spend), 68, 350, { size: 23, bold: true, color: '#FFFFFF' });
    doc.roundedRect(258, 310, 188, 86, 10).fill('#1F2937');
    text(doc, 'Conversion Value', 276, 330, { size: 8, bold: true, color: '#94A3B8' });
    text(doc, money(summary.revenue), 276, 350, { size: 23, bold: true, color: '#FFFFFF' });
    doc.roundedRect(466, 310, 142, 86, 10).fill('#1F2937');
    text(doc, 'ROAS', 484, 330, { size: 8, bold: true, color: '#94A3B8' });
    text(doc, `${summary.roas.toFixed(2)}x`, 484, 350, { size: 23, bold: true, color: '#FFFFFF' });
    text(doc, `Generated ${new Date().toISOString().split('T')[0]}`, 50, 505, { size: 9, color: '#94A3B8', width: 280 });

    // Summary
    doc.addPage();
    drawHeader(doc, 'Executive Summary', `${client.name} | ${from} to ${to}`);
    sectionTitle(doc, 'Executive Summary', p.left, 82, p.width);
    drawMetricGrid(doc, [
        { label: 'Total Spend', value: money(summary.spend), sub: `${money(summary.cpc)} CPC` },
        { label: 'Conversion Value', value: money(summary.revenue), sub: `${summary.roas.toFixed(2)}x ROAS` },
        { label: 'Conversions', value: count(summary.conversions), sub: `${summary.conversionRate.toFixed(2)}% conversion rate` },
        { label: 'Leads', value: count(summary.leads), sub: `${money(summary.cpl)} CPL` },
        { label: 'Impressions', value: count(summary.impressions), sub: `${count(summary.reach)} reach` },
        { label: 'Clicks', value: count(summary.clicks), sub: `${summary.ctr.toFixed(2)}% CTR` },
        { label: 'Avg CPC', value: money(summary.cpc), sub: `${summary.leadRate.toFixed(2)}% click-to-lead` },
        { label: 'Avg CPL', value: money(summary.cpl), sub: `${count(platformRows.length)} platforms` },
    ], p.left, 124, p.width);
    drawFunnel(doc, summary, p.left, 326, p.width, 154);

    // Platform analysis
    doc.addPage();
    drawHeader(doc, 'Platform Breakdown', `${client.name} | ${from} to ${to}`);
    sectionTitle(doc, 'Platform Performance', p.left, 82, p.width);
    drawGroupedBars(doc, 'Spend vs Conversion Value', platformRows, [
        { id: 'spend', label: 'Spend', color: COLORS.indigo },
        { id: 'revenue', label: 'Conversion Value', color: COLORS.pink },
    ], p.left, 124, 480, 220);
    drawDonut(doc, 'Spend Distribution', platformRows, p.left + 500, 124, 270, 220);
    drawTable(doc, 'Platform Efficiency Table', [
        { label: 'Platform', x: 0, w: 120, value: row => row.label, bold: true },
        { label: 'Spend', x: 140, w: 78, value: row => money(row.spend), align: 'right' },
        { label: 'Revenue', x: 234, w: 84, value: row => money(row.revenue), align: 'right' },
        { label: 'ROAS', x: 338, w: 54, value: row => `${row.roas.toFixed(2)}x`, align: 'right', bold: true },
        { label: 'CTR', x: 410, w: 54, value: row => `${row.ctr.toFixed(2)}%`, align: 'right' },
        { label: 'CPC', x: 482, w: 62, value: row => money(row.cpc), align: 'right' },
        { label: 'CPL', x: 562, w: 62, value: row => money(row.cpl), align: 'right' },
        { label: 'Conv.', x: 642, w: 52, value: row => count(row.conversions), align: 'right' },
        { label: 'Leads', x: 708, w: 52, value: row => count(row.leads), align: 'right' },
    ], platformRows, p.left, 374, p.width, 25);

    // Campaigns
    doc.addPage();
    drawHeader(doc, 'Campaign Performance', `${client.name} | ${from} to ${to}`);
    sectionTitle(doc, 'Campaign Performance', p.left, 82, p.width);
    drawHorizontalBars(doc, 'Top Campaigns by Spend', campaignRows, 'spend', p.left, 124, 374, 218, money);
    drawHorizontalBars(doc, 'Top Campaigns by Conversion Value', [...campaignRows].sort((a, b) => b.revenue - a.revenue), 'revenue', p.left + 394, 124, 376, 218, money);
    drawTable(doc, 'Campaign Performance Detail', [
        { label: 'Campaign', x: 0, w: 230, value: row => row.campaign_name, bold: true },
        { label: 'Platform', x: 246, w: 68, value: row => row.platformLabel },
        { label: 'Status', x: 324, w: 50, value: row => row.status },
        { label: 'Spend', x: 386, w: 66, value: row => money(row.spend), align: 'right' },
        { label: 'Revenue', x: 466, w: 74, value: row => money(row.revenue), align: 'right' },
        { label: 'ROAS', x: 556, w: 46, value: row => `${row.roas.toFixed(2)}x`, align: 'right', bold: true },
        { label: 'Leads', x: 616, w: 48, value: row => count(row.leads), align: 'right' },
        { label: 'Conv.', x: 678, w: 48, value: row => count(row.conversions), align: 'right' },
        { label: 'CTR', x: 738, w: 32, value: row => `${row.ctr.toFixed(1)}%`, align: 'right' },
    ], campaignRows.slice(0, 6), p.left, 370, p.width, 25);

    if (campaignRows.length > 6) {
        doc.addPage();
        drawHeader(doc, 'Campaign Detail Continued', `${client.name} | ${from} to ${to}`);
        drawTable(doc, 'Campaign Performance Detail', [
            { label: 'Campaign', x: 0, w: 230, value: row => row.campaign_name, bold: true },
            { label: 'Platform', x: 246, w: 68, value: row => row.platformLabel },
            { label: 'Status', x: 324, w: 50, value: row => row.status },
            { label: 'Spend', x: 386, w: 66, value: row => money(row.spend), align: 'right' },
            { label: 'Revenue', x: 466, w: 74, value: row => money(row.revenue), align: 'right' },
            { label: 'ROAS', x: 556, w: 46, value: row => `${row.roas.toFixed(2)}x`, align: 'right', bold: true },
            { label: 'Leads', x: 616, w: 48, value: row => count(row.leads), align: 'right' },
            { label: 'Conv.', x: 678, w: 48, value: row => count(row.conversions), align: 'right' },
            { label: 'CTR', x: 738, w: 32, value: row => `${row.ctr.toFixed(1)}%`, align: 'right' },
        ], campaignRows.slice(6, 23), p.left, 86, p.width, 25);
    }

    doc.end();

    return {
        filename,
        clientName: client.name,
        summary,
        rowCount: campaignRows.length,
        platformCount: platformRows.length,
    };
}

/**
 * Generate a PDF performance report for a client and pipe it to the response.
 */
export async function generateClientReport(clientId, from, to, res, options = {}) {
    return renderClientReportPdf(clientId, from, to, options, (doc, { filename }) => {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);
    });
}

/**
 * Generate the same report as a buffer so it can be attached to outbound email.
 */
export async function generateClientReportBuffer(clientId, from, to, options = {}) {
    const chunks = [];
    let finished;

    const result = await renderClientReportPdf(clientId, from, to, options, (doc) => {
        finished = new Promise((resolve, reject) => {
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', resolve);
            doc.on('error', reject);
        });
    });

    if (!finished) {
        throw new Error('PDF stream was not initialized');
    }

    await finished;

    return {
        ...result,
        buffer: Buffer.concat(chunks),
    };
}
