import React, { useState } from 'react';
import { Flag, X, ChevronRight, AlertTriangle } from './Icon';
import { authApi } from '../../services/authApi';
import { SpinnerInline } from './StateFeedback';

type ContentType = 'video' | 'track' | 'comment';

const REASONS = [
  { value: 'spam', label: 'Spam or misleading', icon: '🚫' },
  { value: 'harassment', label: 'Harassment or bullying', icon: '😡' },
  { value: 'hate_speech', label: 'Hate speech or symbols', icon: '⚠️' },
  { value: 'misinformation', label: 'Misinformation', icon: '🔎' },
  { value: 'copyright', label: 'Copyright infringement', icon: '©️' },
  { value: 'explicit_content', label: 'Explicit or adult content', icon: '🔞' },
  { value: 'other', label: 'Something else', icon: '📩' },
] as const;

type Reason = (typeof REASONS)[number]['value'];

interface ReportModalProps {
  targetType: ContentType;
  targetId: string;
  targetLabel?: string;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ targetType, targetId, targetLabel, onClose }) => {
  const [step, setStep] = useState<'choose' | 'details' | 'done'>('choose');
  const [selectedReason, setSelectedReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!selectedReason) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await authApi.reportContent({ targetType, targetId, reason: selectedReason, details: details.trim() || undefined });
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full sm:w-[420px] bg-[var(--surface)] border border-[var(--border)] rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-[var(--like)]" />
            <h2 className="text-sm font-bold text-[var(--text)]">Report {targetType}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {step === 'choose' && (
            <div className="space-y-2">
              <p className="text-xs text-[var(--muted)] mb-3">
                Why are you reporting{targetLabel ? ` "${targetLabel}"` : ' this content'}?
              </p>
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => { setSelectedReason(r.value); setStep('details'); }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl bg-[var(--raised)] border border-[var(--border)] hover:border-[var(--accent)]/50 hover:bg-[var(--raised)] transition-all text-left"
                >
                  <span className="text-lg">{r.icon}</span>
                  <span className="text-sm font-medium text-[var(--text)] flex-1">{r.label}</span>
                  <ChevronRight className="w-4 h-4 text-[var(--subtle)]" />
                </button>
              ))}
            </div>
          )}

          {step === 'details' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-[var(--raised)] border border-[var(--border)]">
                <AlertTriangle className="w-4 h-4 text-[var(--warning)] shrink-0" />
                <span className="text-xs text-[var(--muted)]">
                  Reason: <span className="font-bold text-[var(--text)]">{REASONS.find(r => r.value === selectedReason)?.label}</span>
                </span>
              </div>
              <div>
                <label className="text-xs font-bold text-[var(--muted)] mb-1 block">Additional details (optional)</label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value.slice(0, 500))}
                  placeholder="Help us understand what happened..."
                  className="w-full bg-[var(--raised)] border border-[var(--border)] rounded-2xl px-4 py-3 text-sm text-[var(--text)] placeholder-[var(--subtle)] resize-none outline-none focus:border-[var(--accent)]/60 transition-colors"
                  rows={3}
                />
                <p className="text-right text-[10px] text-[var(--subtle)] mt-1">{details.length}/500</p>
              </div>
              {error && (
                <p className="text-xs text-[var(--danger)] bg-[var(--like)]/10 border border-[var(--like)]/30 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setStep('choose')}
                  className="flex-1 py-2.5 rounded-2xl border border-[var(--border)] text-[var(--muted)] text-sm font-medium hover:bg-[var(--border)] transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-2xl bg-[var(--like)] text-[var(--text)] text-sm font-bold hover:bg-[var(--danger)] transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <SpinnerInline size="sm" /> : null}
                  {isSubmitting ? 'Submitting…' : 'Submit Report'}
                </button>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--success)]/20 border border-[var(--success)]/30 flex items-center justify-center">
                <Flag className="w-7 h-7 text-[var(--success)]" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--text)]">Report Submitted</h3>
                <p className="text-xs text-[var(--muted)] mt-1">Our team will review this content. Thank you for keeping Kinetic safe.</p>
              </div>
              <button onClick={onClose} className="px-6 py-2.5 rounded-full bg-[var(--raised)] border border-[var(--border)] text-sm font-bold text-[var(--text)] hover:bg-[var(--raised)] transition-colors">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
