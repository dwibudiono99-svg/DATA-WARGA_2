import React, { useState, useEffect } from 'react';
import { useRBAC } from '../context/RBACContext';
import {
  Mail,
  Send,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  Users,
  Shield,
  FileCheck2,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import {
  getSavedDriveAccessToken,
  requestDriveAccessToken,
} from '../services/googleDriveService';
import { sendEmailViaGmail, getGmailUserProfile } from '../services/gmailService';

interface KirimEmailGmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultRecipient?: string;
  defaultSubject?: string;
  defaultBodyHtml?: string;
  category?: 'surat' | 'iuran' | 'pengumuman' | 'umum';
}

export const KirimEmailGmailModal: React.FC<KirimEmailGmailModalProps> = ({
  isOpen,
  onClose,
  defaultRecipient = '',
  defaultSubject = '',
  defaultBodyHtml = '',
  category = 'umum',
}) => {
  const { wargaList, infoPerumahan, currentUser, logAudit } = useRBAC();

  const [toEmail, setToEmail] = useState(defaultRecipient);
  const [subject, setSubject] = useState(defaultSubject);
  const [bodyText, setBodyText] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<'custom' | 'surat' | 'iuran' | 'broadcast'>('custom');

  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [connectedGmail, setConnectedGmail] = useState<string | null>('wahyubudiono69@gmail.com');

  useEffect(() => {
    if (isOpen) {
      setToEmail(defaultRecipient);
      setSubject(defaultSubject);
      setStatusMessage(null);

      // Pre-fill body based on category if empty
      if (defaultBodyHtml) {
        setBodyText(defaultBodyHtml.replace(/<[^>]*>?/gm, ''));
      } else if (category === 'surat') {
        setSubject(`[Resmi RT 04] Surat Pengantar RT Anda Telah Disahkan`);
        setBodyText(
          `Halo Warga,\n\nSurat pengantar RT yang Anda ajukan telah disahkan oleh Ketua RT ${infoPerumahan.rtRw}.\nAnda dapat mengunduh atau mencetak berkas surat digital melalui portal web SIM-Warga.\n\nSalam hormat,\nPengurus Lingkungan ${infoPerumahan.namaPerumahan}`
        );
      } else if (category === 'iuran') {
        setSubject(`[Kuitansi Resmi RT 04] Konfirmasi Pembayaran Kas & Iuran`);
        setBodyText(
          `Halo Warga,\n\nPembayaran iuran lingkungan Anda telah diverifikasi oleh Bendahara RT.\nTerima kasih atas kontribusi aktif Anda dalam menjaga kebersihan dan keamanan lingkungan ${infoPerumahan.namaPerumahan}.\n\nSalam hormat,\nPengurus RT 04`
        );
      } else {
        setSubject(defaultSubject || `[Informasi RT 04] Pengumuman Warga ${infoPerumahan.namaPerumahan}`);
        setBodyText(
          `Kepada Seluruh Warga ${infoPerumahan.namaPerumahan},\n\nBerikut informasi penting dari Pengurus RT:\n\nMohon perhatian dan kerjasamanya.\n\nSalam hormat,\nPengurus RT 04`
        );
      }
    }
  }, [isOpen, defaultRecipient, defaultSubject, defaultBodyHtml, category]);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!toEmail.trim() || !subject.trim() || !bodyText.trim()) {
      setStatusMessage({ type: 'error', text: 'Harap lengkapi alamat email, subjek, dan isi pesan.' });
      return;
    }

    setIsSending(true);
    setStatusMessage(null);

    try {
      let token = getSavedDriveAccessToken();
      if (!token) {
        token = await requestDriveAccessToken(undefined, 'wahyubudiono69@gmail.com');
      }

      await sendEmailViaGmail(token, {
        to: toEmail.trim(),
        subject: subject.trim(),
        bodyText: bodyText.trim(),
        senderName: `Pengurus RT ${infoPerumahan.rtRw}`,
      });

      setStatusMessage({
        type: 'success',
        text: `Email berhasil dikirim langsung via Gmail ke ${toEmail}!`,
      });

      logAudit(
        'GMAIL_SEND',
        'Layanan Gmail',
        'success',
        `Mengirim email resmi via Gmail ke ${toEmail} dengan subjek "${subject}".`
      );

      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: 'Gagal mengirim email: ' + (err?.message || err),
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 space-y-4 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-slate-900">
                  Kirim Email Resmi via Gmail
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                  Gmail API
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Kirim pemberitahuan langsung dari akun <strong>{connectedGmail}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Alert */}
        {statusMessage && (
          <div
            className={`p-3 rounded-2xl text-xs flex items-center gap-2.5 animate-in fade-in ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-950'
                : 'bg-rose-50 border border-rose-200 text-rose-950'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold">{statusMessage.text}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSend} className="space-y-3.5 text-xs">
          {/* Quick Recipient Select */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700">Tujuan (Email Warga / Penerima):</label>
              <select
                aria-label="Pilih dari Warga Terdata"
                onChange={(e) => {
                  if (e.target.value) {
                    setToEmail(e.target.value);
                  }
                }}
                className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 font-medium cursor-pointer"
              >
                <option value="">-- Pilih dari Warga Terdata --</option>
                {wargaList
                  .filter((w) => w.email)
                  .map((w) => (
                    <option key={w.id} value={w.email}>
                      {w.namaLengkap} ({w.blokRumah} No. {w.nomorRumah}) - {w.email}
                    </option>
                  ))}
              </select>
            </div>
            <input
              type="email"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              placeholder="contoh: warga@gmail.com"
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs"
            />
          </div>

          {/* Subject */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700">Subjek Pesan:</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subjek email..."
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs font-semibold"
            />
          </div>

          {/* Message Body */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700">Isi Email:</label>
            <textarea
              rows={6}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Tuliskan isi pesan pengumuman atau informasi resmi..."
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs leading-relaxed font-sans"
            />
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div className="text-[11px] text-slate-400">
              Dikirim langsung dari server Gmail resmi
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-3d btn-3d-white text-xs px-4 py-2"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSending}
                className={`text-xs px-5 py-2 ${
                  isSending
                    ? 'btn-3d bg-rose-400 text-white cursor-wait'
                    : 'btn-3d btn-3d-rose'
                }`}
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    <span>Kirim Email Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
