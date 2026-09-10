import React, { useState } from 'react';
import { Share2, Check, Copy, X, Loader2 } from 'lucide-react';
import { videoApi } from '../services/videoApi';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  videoId?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  title,
  videoId,
}) => {
  const [copied, setCopied] = useState(false);
  const [isCopying, setIsCopying] = useState(false);

  if (!isOpen) return null;

  const shareUrl = window.location.href;

  const handleCopy = async () => {
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(shareUrl);
      if (videoId) {
        void videoApi.recordShare(videoId).catch(() => {});
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#151c25] border border-[#232a34] rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#9ca3af] hover:text-white p-1 rounded-lg"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#2f6bff]/15 text-[#2f6bff] flex items-center justify-center">
            <Share2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Share {title}</h3>
            <p className="text-[11px] text-[#9ca3af]">Link to this audio asset & 9:16 feed</p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-2 rounded-xl bg-[#0d141d] border border-[#232a34]">
          <input
            type="text"
            readOnly
            value={shareUrl}
            className="bg-transparent text-xs text-[#9ca3af] flex-1 outline-none truncate"
          />
          <button
            onClick={handleCopy}
            disabled={isCopying || copied}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              copied ? 'bg-[#4edea3] text-black' : 'bg-[#2f6bff] text-white hover:bg-[#2558d6] disabled:opacity-70'
            }`}
          >
            {isCopying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Copying
              </>
            ) : copied ? (
              <>
                <Check className="w-3.5 h-3.5" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" /> Copy
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
