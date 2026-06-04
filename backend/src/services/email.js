// Sends application emails, including Gmail API report delivery with PDF attachments.
import { google } from 'googleapis';

const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const GMAIL_EMAIL_SCOPE = 'email'; // needed to read the user's email address via userinfo API

function getOAuthClient() {
    const required = [
        'GMAIL_CLIENT_ID',
        'GMAIL_CLIENT_SECRET',
    ];
    const missing = required.filter((key) => !process.env[key]);
    if (missing.length > 0) {
        throw new Error(`Missing Gmail API configuration: ${missing.join(', ')}`);
    }

    const oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI || `${process.env.PUBLIC_API_ORIGIN || 'http://localhost:3001'}/api/reports/email/gmail/callback`,
    );
    return oauth2Client;
}

function getGmailClient(refreshToken) {
    if (!refreshToken) {
        throw new Error('Gmail is not connected for this user');
    }

    const oauth2Client = getOAuthClient();
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    return google.gmail({ version: 'v1', auth: oauth2Client });
}

export function buildUserGmailAuthUrl({ state }) {
    return getOAuthClient().generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [GMAIL_SEND_SCOPE, GMAIL_EMAIL_SCOPE],
        state,
    });
}

export async function exchangeGmailAuthCode(code) {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const profile = await oauth2.userinfo.get();

    return {
        tokens,
        gmailEmail: profile.data.email,
    };
}

function base64Url(value) {
    return Buffer.from(value)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function foldBase64(value) {
    return value.replace(/.{1,76}/g, '$&\r\n').trim();
}

function encodeHeader(value) {
    return `=?UTF-8?B?${Buffer.from(String(value), 'utf8').toString('base64')}?=`;
}

function buildMimeMessage({ from, to, subject, html, text, attachments = [] }) {
    const mixedBoundary = `mixed_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const altBoundary = `alt_${Date.now()}_${Math.random().toString(16).slice(2)}`;

    const lines = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${encodeHeader(subject)}`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
        '',
        `--${mixedBoundary}`,
        `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
        '',
        `--${altBoundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: 7bit',
        '',
        text || 'A CloudCRM report is attached.',
        '',
        `--${altBoundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        'Content-Transfer-Encoding: 7bit',
        '',
        html,
        '',
        `--${altBoundary}--`,
    ];

    attachments.forEach((attachment) => {
        lines.push(
            '',
            `--${mixedBoundary}`,
            `Content-Type: ${attachment.contentType || 'application/octet-stream'}; name="${attachment.filename}"`,
            'Content-Transfer-Encoding: base64',
            `Content-Disposition: attachment; filename="${attachment.filename}"`,
            '',
            foldBase64(attachment.content.toString('base64')),
        );
    });

    lines.push('', `--${mixedBoundary}--`, '');
    return lines.join('\r\n');
}

export async function sendGmailMessage({ from, refreshToken, to, subject, html, text, attachments = [] }) {
    if (!from) {
        throw new Error('Sender Gmail address is required');
    }

    if (process.env.NODE_ENV !== 'production' && process.env.GMAIL_SEND_DISABLED !== 'false') {
        console.log(`[EMAIL-DEV] Gmail report email would be sent from ${from} to: ${to}`);
        console.log(`[EMAIL-DEV] Subject: ${subject}`);
        console.log(`[EMAIL-DEV] Attachments: ${attachments.map((item) => item.filename).join(', ')}`);
        return { id: `dev-${Date.now()}` };
    }

    const gmail = getGmailClient(refreshToken);
    const raw = base64Url(buildMimeMessage({ from, to, subject, html, text, attachments }));
    const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw },
    });

    return result.data;
}

export async function sendKeycloakCredentialsEmail({ email, password, name, role }) {
    const loginUrl = `${process.env.FRONTEND_ORIGIN || 'http://localhost:5173'}/login`;

    if (process.env.NODE_ENV === 'production') {
        // TODO: integrate with email provider
        // await transporter.sendMail({
        //   from: process.env.EMAIL_USER,
        //   to: email,
        //   subject: `CloudCRM — Your ${role} Account Has Been Created`,
        //   html: `
        //     <h2>Welcome to CloudCRM, ${name}!</h2>
        //     <p>Your ${role} account has been created in Keycloak.</p>
        //     <p><strong>Email:</strong> ${email}</p>
        //     <p><strong>Temporary Password:</strong> ${password}</p>
        //     <br />
        //     <p>Please sign in through Keycloak and change your password immediately:</p>
        //     <p><a href="${loginUrl}">Log in to CloudCRM</a></p>
        //     <br />
        //     <p style="color: #666; font-size: 12px;">
        //       This is an automated message. Do not share your credentials with anyone.
        //       If you did not expect this email, please contact the administrator.
        //     </p>
        //   `,
        // });
        console.log(`[EMAIL] ${role} Keycloak credentials email queued for: ${email}`);
    } else {
        console.log(`[EMAIL-DEV] ${role} Keycloak credentials would be sent to: ${email}`);
        console.log(`[EMAIL-DEV] Name: ${name}`);
        console.log(`[EMAIL-DEV] Login URL: ${loginUrl}`);
        console.log(`[EMAIL-DEV] Temp password: ${password}`);
    }
}
