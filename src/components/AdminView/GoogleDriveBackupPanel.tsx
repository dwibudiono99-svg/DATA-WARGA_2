import React, { useState, useEffect } from 'react';
import { useRBAC } from '../../context/RBACContext';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  HardDrive,
  Key,
  ExternalLink,
  Trash2,
  Shield,
  FileCode,
  Check,
  ChevronRight,
  FolderOpen,
  LogOut,
  Info,
} from 'lucide-react';
import {
  GoogleDriveFileItem,
  getSavedDriveAccessToken,
  requestDriveAccessToken,
  clearDriveAccessToken,
  uploadBackupToGoogleDrive,
  listBackupsFromGoogleDrive,
  downloadBackupFromGoogleDrive,
  deleteBackupFromGoogleDrive,
} from '../../services/googleDriveService';

interface GoogleDriveBackupPanelProps {
  onSuccessRestored?: () => void;
}

export const GoogleDriveBackupPanel: React.FC<GoogleDriveBackupPanelProps> = ({ onSuccessRestored }) => {
  const {
    getFullBackupData,
    importFullBackupJSON,
    infoPerumahan,
    currentUser,
    logAudit,
    wargaList,
    iuranList,
    suratList,
  } = useRBAC();

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<GoogleDriveFileItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRestoringId, setIsRestoringId] = useState<string | null>(null);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);

  // Status & notifications
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  // Restore mode
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');

  // Custom Client ID modal / state
  const [customClientId, setCustomClientId] = useState<string>(() => {
    return localStorage.getItem('sim_warga_google_client_id') || '';
  });
  const [showConfigModal, setShowConfigModal] = useState(false);

  // Check saved token on mount
  useEffect(() => {
    const saved = getSavedDriveAccessToken();
    if (saved) {
      setAccessToken(saved);
      loadFiles(saved);
    }
  }, []);

  const loadFiles = async (token: string) => {
    setIsLoadingList(true);
    try {
      const files = await listBackupsFromGoogleDrive(token);
      setDriveFiles(files);
      setStatusMessage(null);
    } catch (err: any) {
      if (String(err?.message || '').includes('401') || String(err?.message || '').includes('auth')) {
        clearDriveAccessToken();
        setAccessToken(null);
        setStatusMessage({
          type: 'info',
          text: 'Sesi Google Drive telah berakhir. Silakan hubungkan ulang akun Google Anda.',
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: 'Gagal memuat berkas cadangan dari Google Drive: ' + (err?.message || err),
        });
      }
    } finally {
      setIsLoadingList(false);
    }
  };

  const handleConnectGoogle = async () => {
    setStatusMessage(null);
    try {
      const token = await requestDriveAccessToken(customClientId.trim());
      setAccessToken(token);
      setStatusMessage({
        type: 'success',
        text: 'Berhasil terhubung dengan Google Drive! Memuat daftar cadangan...',
      });
      loadFiles(token);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('CLIENT_ID_REQUIRED')) {
        setShowConfigModal(true);
      } else {
        setStatusMessage({
          type: 'error',
          text: 'Gagal menghubungkan Google Drive: ' + msg,
        });
      }
    }
  };

  const handleDisconnectGoogle = () => {
    clearDriveAccessToken();
    setAccessToken(null);
    setDriveFiles([]);
    setStatusMessage({
      type: 'info',
      text: 'Koneksi akun Google Drive telah diputus.',
    });
  };

  // Upload current database snapshot to Google Drive
  const handleUploadBackup = async () => {
    if (!accessToken) {
      handleConnectGoogle();
      return;
    }

    setIsUploading(true);
    setStatusMessage(null);
    try {
      const backupData = getFullBackupData();
      const safeRT = infoPerumahan.rtRw.replace(/[^a-zA-Z0-9]/g, '_');
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const fileName = `backup_sim_warga_${safeRT}_${dateStr}_${timeStr}.json`;

      const uploaded = await uploadBackupToGoogleDrive(accessToken, backupData, fileName);

      setStatusMessage({
        type: 'success',
        text: `Berhasil mengunggah cadangan ke Google Drive: "${uploaded.name}". Berkas tersimpan aman di cloud.`,
      });

      logAudit(
        'GDRIVE_BACKUP_UPLOAD',
        'Cadangan Cloud',
        'success',
        `Cadangan database disimpan ke Google Drive (${uploaded.name}). ${wargaList.length} warga, ${iuranList.length} iuran.`
      );

      // Refresh list
      loadFiles(accessToken);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Gagal mengunggah ke Google Drive: ' + (err?.message || err),
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Restore snapshot from Google Drive file
  const handleRestoreFile = async (file: GoogleDriveFileItem) => {
    if (!accessToken) return;

    const confirmMsg =
      restoreMode === 'replace'
        ? `PERINGATAN: Memulihkan "${file.name}" dengan mode "Gantikan Total" akan menimpa data kependudukan dan transaksi kas saat ini dengan data cadangan ini. Lanjutkan?`
        : `Pulihkan "${file.name}" dengan mode "Gabungkan Data"? Data baru akan ditambahkan tanpa menghapus data yang sudah ada.`;

    if (!confirm(confirmMsg)) return;

    setIsRestoringId(file.id);
    setStatusMessage(null);

    try {
      const backupObj = await downloadBackupFromGoogleDrive(accessToken, file.id);

      const ok = importFullBackupJSON(backupObj, restoreMode);
      if (ok) {
        setStatusMessage({
          type: 'success',
          text: `Pemulihan sukses! Database telah dipulihkan langsung dari Google Drive ("${file.name}").`,
        });

        logAudit(
          'GDRIVE_BACKUP_RESTORE',
          'Cadangan Cloud',
          'success',
          `Memulihkan database dari Google Drive (${file.name}) mode: ${restoreMode === 'replace' ? 'Gantikan Total' : 'Gabungkan Data'}.`
        );

        if (onSuccessRestored) {
          onSuccessRestored();
        }
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Gagal memulihkan dari Google Drive: ' + (err?.message || err),
      });
    } finally {
      setIsRestoringId(null);
    }
  };

  // Delete obsolete backup from Google Drive
  const handleDeleteFile = async (file: GoogleDriveFileItem) => {
    if (!accessToken) return;

    if (!confirm(`Hapus berkas cadangan "${file.name}" dari Google Drive Anda secara permanen?`)) {
      return;
    }

    setIsDeletingId(file.id);
    try {
      await deleteBackupFromGoogleDrive(accessToken, file.id);
      setStatusMessage({
        type: 'info',
        text: `Berkas "${file.name}" berhasil dihapus dari Google Drive.`,
      });
      setDriveFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Gagal menghapus berkas: ' + (err?.message || err),
      });
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleSaveCustomClientId = () => {
    localStorage.setItem('sim_warga_google_client_id', customClientId.trim());
    setShowConfigModal(false);
    handleConnectGoogle();
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900">
                Cadangan Cloud Google Drive (Online Backup & Restore)
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                OAuth 2.0
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Simpan dan pulihkan database RT secara otomatis dan aman langsung ke akun Google Drive Anda
            </p>
          </div>
        </div>

        {/* Action button: Connect / Disconnect */}
        <div className="flex items-center gap-2">
          {accessToken ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Terhubung ke Drive</span>
              </span>
              <button
                type="button"
                onClick={handleDisconnectGoogle}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Putuskan Hubungan"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Putus</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleConnectGoogle}
              className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-600/20 cursor-pointer"
            >
              <Cloud className="w-4 h-4 text-white" />
              <span>Hubungkan Akun Google Drive</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            title="Pengaturan Kredensial OAuth Client ID"
          >
            <Key className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-2xl text-xs flex items-center justify-between gap-3 animate-in fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-950'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 border border-rose-200 text-rose-950'
              : 'bg-blue-50 border border-blue-200 text-blue-950'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : statusMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <Info className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span className="font-semibold">{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            &times;
          </button>
        </div>
      )}

      {/* Main 2-column cloud action grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (1 col): Backup to Google Drive */}
        <div className="bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-2xl border border-blue-100 p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-blue-900 font-extrabold text-sm">
              <CloudUpload className="w-5 h-5 text-blue-600" />
              <span>1. Cadangkan ke Google Drive</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Kirim salinan database utuh (seluruh {wargaList.length} warga, tagihan kas, surat pengantar, dan izin RBAC) langsung ke Google Drive Anda.
            </p>

            <div className="p-3 rounded-xl bg-white border border-blue-100 space-y-1.5 text-xs text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Jumlah Warga:</span>
                <span className="font-bold text-slate-900">{wargaList.length} Warga</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Rekap Iuran:</span>
                <span className="font-bold text-slate-900">{iuranList.length} Data</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Berkas Surat:</span>
                <span className="font-bold text-slate-900">{suratList.length} Arsip</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-100">
                <span className="text-slate-500">Format Snapshot:</span>
                <span className="font-mono font-bold text-blue-700">.json (v2.5)</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <button
              type="button"
              disabled={isUploading}
              onClick={handleUploadBackup}
              className={`w-full py-3 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all shadow-md ${
                isUploading
                  ? 'bg-blue-400 text-white cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/25 cursor-pointer'
              }`}
            >
              {isUploading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Mengunggah ke Drive...</span>
                </>
              ) : (
                <>
                  <CloudUpload className="w-4 h-4" />
                  <span>Unggah Snapshot ke Drive Sekarang</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-slate-400 text-center">
              Berkas akan tersimpan di akun Google Drive pribadi Anda dengan enkripsi resmi Google.
            </p>
          </div>
        </div>

        {/* Right Column (2 cols): List of Backups in Google Drive & 1-Click Restore */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
              <FolderOpen className="w-5 h-5 text-indigo-600" />
              <span>2. Berkas Cadangan Tersedia di Google Drive</span>
              {driveFiles.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                  {driveFiles.length} berkas
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {/* Restore Mode Select */}
              <div className="flex items-center gap-1.5 text-xs bg-slate-100 p-1 rounded-xl">
                <span className="text-[10px] font-bold text-slate-500 px-1">Mode Pulihkan:</span>
                <button
                  type="button"
                  onClick={() => setRestoreMode('replace')}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    restoreMode === 'replace'
                      ? 'bg-white text-indigo-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Gantikan Total
                </button>
                <button
                  type="button"
                  onClick={() => setRestoreMode('merge')}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    restoreMode === 'merge'
                      ? 'bg-white text-indigo-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Gabungkan
                </button>
              </div>

              {accessToken && (
                <button
                  type="button"
                  disabled={isLoadingList}
                  onClick={() => loadFiles(accessToken)}
                  className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                  title="Segarkan Daftar Berkas"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingList ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          </div>

          {!accessToken ? (
            <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-3 bg-slate-50/50">
              <Cloud className="w-12 h-12 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <h4 className="font-extrabold text-sm text-slate-800">
                  Google Drive Belum Terhubung
                </h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Hubungkan akun Google Anda untuk melihat riwayat cadangan cloud, mengunduh, atau memulihkan data RT secara langsung dengan satu klik.
                </p>
              </div>
              <button
                type="button"
                onClick={handleConnectGoogle}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
              >
                <Cloud className="w-4 h-4" />
                <span>Masuk & Hubungkan Google Drive</span>
              </button>
            </div>
          ) : isLoadingList ? (
            <div className="p-8 rounded-2xl border border-slate-200 text-center space-y-2 bg-slate-50">
              <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-600">
                Memindai berkas cadangan dari akun Google Drive...
              </p>
            </div>
          ) : driveFiles.length === 0 ? (
            <div className="p-8 rounded-2xl border border-slate-200 text-center space-y-2 bg-slate-50">
              <FolderOpen className="w-8 h-8 text-slate-400 mx-auto" />
              <h5 className="font-bold text-xs text-slate-700">Belum Ada Berkas Cadangan di Google Drive</h5>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                Klik tombol "Unggah Snapshot ke Drive Sekarang" di sebelah kiri untuk membuat cadangan cloud pertama Anda.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {driveFiles.map((file) => {
                const isRestoring = isRestoringId === file.id;
                const isDeleting = isDeletingId === file.id;

                const formattedDate = file.modifiedTime
                  ? new Date(file.modifiedTime).toLocaleString('id-ID', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : 'Waktu tidak diketahui';

                return (
                  <div
                    key={file.id}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 shrink-0 mt-0.5">
                        <FileCode className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <h5 className="font-bold text-xs text-slate-900 truncate" title={file.name}>
                          {file.name}
                        </h5>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>Diperbarui: {formattedDate}</span>
                          </span>
                          {file.size && (
                            <span>• {(Number(file.size) / 1024).toFixed(1)} KB</span>
                          )}
                          <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 font-bold rounded">
                            Google Cloud
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions: Restore & Delete */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        disabled={isRestoring || isDeleting}
                        onClick={() => handleRestoreFile(file)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                          isRestoring
                            ? 'bg-indigo-300 text-white cursor-wait'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs shadow-indigo-600/20'
                        }`}
                        title="Pulihkan data dari berkas ini"
                      >
                        {isRestoring ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Memulihkan...</span>
                          </>
                        ) : (
                          <>
                            <CloudDownload className="w-3.5 h-3.5" />
                            <span>Pulihkan (Restore)</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        disabled={isRestoring || isDeleting}
                        onClick={() => handleDeleteFile(file)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Hapus cadangan ini dari Google Drive"
                      >
                        {isDeleting ? (
                          <RefreshCw className="w-4 h-4 animate-spin text-rose-500" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* OAuth Client ID Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                  <Key className="w-5 h-5" />
                </div>
                <h4 className="font-extrabold text-base text-slate-900">
                  Konfigurasi Google OAuth Client ID
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p>
                Untuk menghubungkan aplikasi dengan akun Google Drive Anda, masukkan <strong>Google OAuth Client ID</strong> yang telah dikonfigurasi pada Google Cloud Console untuk web applet ini.
              </p>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-800 block">
                  Google Client ID (OAuth 2.0 Web Client):
                </label>
                <input
                  type="text"
                  value={customClientId}
                  onChange={(e) => setCustomClientId(e.target.value)}
                  placeholder="Contoh: 535692332024-xxxxxxx.apps.googleusercontent.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-[11px]"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-[11px] text-slate-600">
                <span className="font-bold text-slate-800 block">Informasi Pengaturan Google Cloud:</span>
                <p>• Scope yang digunakan: <code className="text-blue-700 font-mono">https://www.googleapis.com/auth/drive.file</code> (Akses terbatas hanya pada file yang dibuat oleh aplikasi ini)</p>
                <p>• Authorized JavaScript origins: domain hosting aplikasi ini.</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveCustomClientId}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer shadow-sm"
              >
                Simpan & Hubungkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
