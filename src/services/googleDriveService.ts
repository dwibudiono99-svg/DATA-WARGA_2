/**
 * Google Drive Backup & Restore Client Service
 *
 * Utilizes Google OAuth 2.0 Token Client (GIS) client-side in the browser
 * with scope 'https://www.googleapis.com/auth/drive.file'
 *
 * Capabilities:
 * - Authorize user with Google
 * - Save database snapshot (.json) to Google Drive in a dedicated 'SIM-Warga_Backups' folder or root
 * - List SIM-Warga backup files existing in Google Drive
 * - Download and parse backup files directly from Google Drive for 1-click restore
 * - Check authorization status and logout
 */

export interface GoogleDriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
  description?: string;
}

const DRIVE_FILE_SCOPE =
  'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly';
const TOKEN_STORAGE_KEY = 'sim_warga_gdrive_access_token';
const TOKEN_EXPIRY_KEY = 'sim_warga_gdrive_token_expiry';

// Retrieve stored token if still valid
export function getSavedDriveAccessToken(): string | null {
  try {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!token || !expiry) return null;
    if (Date.now() > Number(expiry)) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(TOKEN_EXPIRY_KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function saveDriveAccessToken(token: string, expiresInSeconds: number = 3600) {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    const expiryTimestamp = Date.now() + (expiresInSeconds - 60) * 1000;
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(expiryTimestamp));
  } catch {
    // ignore
  }
}

export function clearDriveAccessToken() {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_EXPIRY_KEY);
  } catch {
    // ignore
  }
}

/**
 * Loads the Google Identity Services client script if not already loaded
 */
export function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve();
    if ((window as any).google?.accounts?.oauth2) {
      return resolve();
    }

    const existingScript = document.getElementById('google-gis-script');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-gis-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (e) => reject(new Error('Gagal memuat Google Identity Services script'));
    document.head.appendChild(script);
  });
}

/**
 * Initiates the Google OAuth token client popup flow.
 * Note: If no custom client ID is injected, we provide a clean, helpful fallback
 * that explains and supports user input or direct demo connection.
 */
export async function requestDriveAccessToken(customClientId?: string, loginHint?: string): Promise<string> {
  await loadGisScript();

  const clientId =
    customClientId ||
    (typeof process !== 'undefined' ? (process.env as any).VITE_GOOGLE_CLIENT_ID : '') ||
    localStorage.getItem('sim_warga_google_client_id') ||
    '';

  if (!clientId) {
    throw new Error(
      'CLIENT_ID_REQUIRED: Google OAuth Client ID diperlukan untuk koneksi langsung ke Google Cloud.'
    );
  }

  return new Promise((resolve, reject) => {
    try {
      const google = (window as any).google;
      if (!google?.accounts?.oauth2) {
        return reject(new Error('Google Identity Services belum siap.'));
      }

      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_FILE_SCOPE,
        hint: loginHint || undefined,
        callback: (response: any) => {
          if (response.error) {
            return reject(new Error(response.error_description || response.error));
          }
          if (response.access_token) {
            saveDriveAccessToken(response.access_token, response.expires_in || 3600);
            resolve(response.access_token);
          } else {
            reject(new Error('Token akses tidak ditemukan dalam respons Google.'));
          }
        },
      });

      client.requestAccessToken({
        hint: loginHint || undefined,
      });
    } catch (err: any) {
      reject(err);
    }
  });
}

/**
 * Uploads a JSON backup file to Google Drive using multipart/related upload.
 */
export async function uploadBackupToGoogleDrive(
  accessToken: string,
  backupData: any,
  fileName: string
): Promise<{ id: string; name: string; webViewLink?: string }> {
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    description: `Cadangan Database SIM-Warga RT 04 (${new Date().toLocaleString('id-ID')})`,
    properties: {
      app: 'SIM-Warga',
      type: 'system_backup',
      version: backupData.systemVersion || '2.5',
    },
  };

  const fileContent = JSON.stringify(backupData, null, 2);
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    fileContent +
    closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(`Gagal mengunggah ke Google Drive: ${message}`);
  }

  return response.json();
}

/**
 * Lists SIM-Warga backup files from Google Drive created by this app.
 */
export async function listBackupsFromGoogleDrive(accessToken: string): Promise<GoogleDriveFileItem[]> {
  // Query files that match json mimeType or name starting with backup_sim_warga
  const query = "trashed = false and (name contains 'backup_sim_warga' or mimeType = 'application/json')";
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    query
  )}&fields=files(id,name,mimeType,createdTime,modifiedTime,size,description)&orderBy=modifiedTime desc&pageSize=20`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(`Gagal membaca berkas dari Google Drive: ${message}`);
  }

  const result = await response.json();
  return result.files || [];
}

/**
 * Downloads a backup file's JSON content from Google Drive given its file ID.
 */
export async function downloadBackupFromGoogleDrive(
  accessToken: string,
  fileId: string
): Promise<any> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(`Gagal mengunduh file dari Google Drive: ${message}`);
  }

  return response.json();
}

/**
 * Deletes a file from Google Drive (e.g., obsolete backup)
 */
export async function deleteBackupFromGoogleDrive(
  accessToken: string,
  fileId: string
): Promise<boolean> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData?.error?.message || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(`Gagal menghapus file dari Google Drive: ${message}`);
  }

  return true;
}
