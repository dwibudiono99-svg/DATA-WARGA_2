/**
 * Gmail Service for SIM-Warga
 * 
 * Provides client-side email delivery via Gmail API v4:
 * - Sending official RT Pengantar letters to residents
 * - Sending payment / iuran receipts and reminders
 * - Sending broadcast announcements to residents' registered email addresses
 */

export interface SendEmailPayload {
  to: string;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  senderName?: string;
}

/**
 * Creates an RFC 2822 compliant MIME email string and encodes it as base64url
 */
function createRawEmail(payload: SendEmailPayload): string {
  const fromName = payload.senderName || 'Pengurus RT 04';
  const boundary = '____sim_warga_boundary____' + Date.now();

  const lines = [
    `To: <${payload.to}>`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(payload.subject)))}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    payload.bodyText || payload.bodyHtml?.replace(/<[^>]*>?/gm, '') || '',
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    payload.bodyHtml || `<p>${payload.bodyText?.replace(/\n/g, '<br/>')}</p>`,
    '',
    `--${boundary}--`,
  ];

  const email = lines.join('\r\n');

  // Convert to base64url (RFC 4648 §5)
  const encodedEmail = btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return encodedEmail;
}

/**
 * Sends an email using the user's Gmail account via Gmail API
 */
export async function sendEmailViaGmail(
  accessToken: string,
  payload: SendEmailPayload
): Promise<{ id: string; threadId: string }> {
  const raw = createRawEmail(payload);

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message ||
        `Gagal mengirim email lewat Gmail API (HTTP ${res.status}). Pastikan izin pengiriman Gmail telah diberikan.`
    );
  }

  return res.json();
}

/**
 * Retrieves the current Gmail user profile (to verify connected email address)
 */
export async function getGmailUserProfile(
  accessToken: string
): Promise<{ emailAddress: string; messagesTotal: number; threadsTotal: number }> {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || 'Gagal mengambil profil akun Gmail.');
  }

  return res.json();
}
