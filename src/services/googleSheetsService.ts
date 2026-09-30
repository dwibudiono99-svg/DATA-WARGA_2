/**
 * Google Sheets Service
 * 
 * Allows creating, updating, and exporting RT resident data, iuran kas,
 * and official register tables directly to Google Sheets using the
 * Google Sheets API v4 with client-side OAuth 2.0.
 */

import { WargaItem, IuranItem, SuratItem } from '../types/rbac';

export interface CreateSpreadsheetResult {
  spreadsheetId: string;
  spreadsheetUrl: string;
}

/**
 * Creates a brand new Google Spreadsheet containing formatted worksheets:
 * 1. Data Kependudukan (Warga & KK)
 * 2. Rekap Kas & Iuran Warga
 * 3. Buku Register Surat Pengantar RT
 */
export async function createRTGoogleSpreadsheet(
  accessToken: string,
  title: string,
  wargaList: WargaItem[],
  iuranList: IuranItem[],
  suratList: SuratItem[],
  namaPerumahan: string,
  rtRw: string
): Promise<CreateSpreadsheetResult> {
  // 1. Initialize spreadsheet with sheets
  const requestBody = {
    properties: {
      title: `${title} - ${rtRw} (${new Date().toLocaleDateString('id-ID')})`,
    },
    sheets: [
      {
        properties: {
          title: 'Data Kependudukan',
          gridProperties: { rowCount: Math.max(100, wargaList.length + 10), columnCount: 15 },
        },
      },
      {
        properties: {
          title: 'Rekap Kas & Iuran',
          gridProperties: { rowCount: Math.max(100, iuranList.length + 10), columnCount: 12 },
        },
      },
      {
        properties: {
          title: 'Register Surat RT',
          gridProperties: { rowCount: Math.max(100, suratList.length + 10), columnCount: 12 },
        },
      },
    ],
  };

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!createRes.ok) {
    const errorData = await createRes.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Gagal membuat Google Spreadsheet (HTTP ${createRes.status})`);
  }

  const spreadsheet = await createRes.json();
  const spreadsheetId = spreadsheet.spreadsheetId;
  const spreadsheetUrl = spreadsheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // 2. Prepare tabular data for each worksheet
  // Tab 1: Warga
  const wargaHeader = [
    'No',
    'Nama Lengkap',
    'NIK',
    'Nomor KK',
    'Blok',
    'No. Rumah',
    'Status Hubungan Keluarga',
    'Status Hunian',
    'Jenis Kelamin',
    'Pekerjaan',
    'No. Handphone / WhatsApp',
    'Jumlah Anggota Keluarga',
    'Tanggal Masuk',
  ];
  const wargaRows = wargaList.map((w, idx) => [
    idx + 1,
    w.namaLengkap,
    `'${w.nik}`,
    `'${w.noKK}`,
    w.blokRumah,
    w.nomorRumah,
    w.statusKeluarga,
    w.statusHunian,
    w.jenisKelamin,
    w.pekerjaan,
    w.noHp,
    w.jumlahAnggotaKeluarga,
    w.tanggalMasuk,
  ]);

  // Tab 2: Iuran
  const iuranHeader = [
    'No',
    'Nama Warga / Kepala Keluarga',
    'Blok',
    'No. Rumah',
    'Periode Bulan',
    'Jenis Iuran',
    'Nominal (Rp)',
    'Status Pembayaran',
    'Tanggal Bayar',
    'Metode Pembayaran',
  ];
  const iuranRows = iuranList.map((i, idx) => [
    idx + 1,
    i.namaWarga,
    i.blokRumah,
    i.nomorRumah,
    i.periodeBulan,
    i.jenisIuran,
    i.nominal,
    i.statusBayar,
    i.tanggalBayar || '-',
    i.metodePembayaran || '-',
  ]);

  // Tab 3: Surat
  const suratHeader = [
    'No',
    'Nomor Surat Resmi RT',
    'Nama Pemohon',
    'NIK',
    'Alamat Rumah',
    'Jenis Surat Pengantar',
    'Keperluan Permohonan',
    'Status Validasi',
    'Tanggal Pengajuan',
    'Tanggal Disahkan / Selesai',
  ];
  const suratRows = suratList.map((s, idx) => [
    idx + 1,
    s.nomorSuratResmi || 'Belum Terbit',
    s.namaPemohon,
    `'${s.nikPemohon}`,
    `${s.blokRumah} No. ${s.nomorRumah}`,
    s.jenisSurat,
    s.keperluan,
    s.status,
    s.tanggalPengajuan,
    s.tanggalSelesai || '-',
  ]);

  // 3. Batch Update Values across all sheets
  const updateData = [
    {
      range: "'Data Kependudukan'!A1:M" + (wargaRows.length + 1),
      values: [wargaHeader, ...wargaRows],
    },
    {
      range: "'Rekap Kas & Iuran'!A1:J" + (iuranRows.length + 1),
      values: [iuranHeader, ...iuranRows],
    },
    {
      range: "'Register Surat RT'!A1:J" + (suratRows.length + 1),
      values: [suratHeader, ...suratRows],
    },
  ];

  const batchUpdateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: updateData,
      }),
    }
  );

  if (!batchUpdateRes.ok) {
    const errorData = await batchUpdateRes.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Gagal mengisi data Google Sheets (HTTP ${batchUpdateRes.status})`);
  }

  return {
    spreadsheetId,
    spreadsheetUrl,
  };
}

/**
 * Appends a new payment or resident row to an existing Google Spreadsheet
 */
export async function appendRowToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  rowValues: (string | number)[]
) {
  const range = `'${sheetName}'!A1`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      range
    )}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [rowValues],
      }),
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData?.error?.message || `Gagal menambahkan baris ke Google Sheets`);
  }

  return res.json();
}
