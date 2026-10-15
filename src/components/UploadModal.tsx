import React, { useState } from 'react';
import { 
  X, 
  UploadCloud, 
  Music, 
  Video as VideoIcon, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  Film, 
  FileAudio,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { uploadApi } from '../services/uploadApi';
import { clearTrackCache } from '../services/musicApi';

const createTrackArtworkUrl = (trackTitle: string, trackArtist: string) =>
  `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(`${trackTitle}-${trackArtist}`)}&backgroundColor=111827,312e81,164e63`;

const createVideoThumbnailUrl = (videoUrl: string) =>
  videoUrl.replace('/upload/', '/upload/so_0/').replace(/\.[^/.?]+(?:\?.*)?$/, '.jpg');

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: (item: { title: string; type: 'track' | 'video' }) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onUploadSuccess }) => {
  const [uploadType, setUploadType] = useState<'track' | 'video'>('video');
  const [step, setStep] = useState<number>(1);
  const [file, setFile] = useState<File | null>(null);
  const [fileDuration, setFileDuration] = useState<number>(0);
  const [durationError, setDurationError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Metadata state
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [caption, setCaption] = useState('');
  const [genre, setGenre] = useState('Electronic');
  const [hashtags, setHashtags] = useState('#kinetic #music #vibes');
  const [coverUrl, setCoverUrl] = useState('');

  if (!isOpen) return null;

  const resetForm = () => {
    setStep(1);
    setFile(null);
    setFileDuration(0);
    setDurationError(null);
    setIsAnalyzing(false);
    setIsUploading(false);
    setUploadProgress(0);
    setErrorMessage(null);
    setTitle('');
    setArtist('');
    setCaption('');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setDurationError(null);
    setErrorMessage(null);
    setIsAnalyzing(true);

    if (uploadType === 'video') {
      try {
        const durationSecs = await uploadApi.checkVideoDuration(selectedFile);
        setFileDuration(durationSecs);
        setIsAnalyzing(false);

        // STRICT FRONTEND DURATION VALIDATION: MAX 90 SECONDS
        if (durationSecs > 90) {
          const mins = Math.floor(durationSecs / 60);
          const secs = Math.floor(durationSecs % 60).toString().padStart(2, '0');
          setDurationError(`Your video is ${mins}:${secs} (${Math.round(durationSecs)}s). Videos must be 90 seconds or shorter.`);
        } else {
          setCaption(selectedFile.name.replace(/\.[^/.]+$/, ''));
          setStep(3); // Proceed to metadata form
        }
      } catch (err) {
        setIsAnalyzing(false);
        setDurationError('Could not inspect video file duration. Please select a valid MP4/WebM video.');
      }
    } else {
      // Track upload
      setFileDuration(180); // Default placeholder duration if unparsed audio metadata
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
      setArtist('Kinetic Creator');
      setIsAnalyzing(false);
      setStep(3);
    }
  };

  const handlePublish = async () => {
    if (!file) return;

    setIsUploading(true);
    setErrorMessage(null);
    setUploadProgress(10);

    try {
      if (uploadType === 'video') {
        // Enforce 90s limit
        if (fileDuration > 90) {
          throw new Error('Videos must be 90 seconds or shorter.');
        }

        const cloudRes = await uploadApi.uploadFileToCloudinary(file, 'video', (pct) => {
          setUploadProgress(10 + Math.round(pct * 0.7));
        });

        setUploadProgress(85);

        await uploadApi.publishVideo({
          caption: caption || title || 'Kinetic Short',
          videoUrl: cloudRes.secure_url,
          thumbnailUrl: createVideoThumbnailUrl(cloudRes.secure_url),
          duration: fileDuration || cloudRes.duration || 30,
          hashtags: hashtags.split(' ').filter(Boolean),
          cloudinaryPublicId: cloudRes.public_id,
        });

        setUploadProgress(100);
        setIsUploading(false);
        setStep(4); // Success step
        onUploadSuccess({ title: caption || title || 'Short Video', type: 'video' });
      } else {
        // Track upload
        const cloudRes = await uploadApi.uploadFileToCloudinary(file, 'auto', (pct) => {
          setUploadProgress(10 + Math.round(pct * 0.7));
        });

        setUploadProgress(85);

        await uploadApi.publishTrack({
          title: title || 'New Sound',
          artist: artist || 'Kinetic Creator',
          genre,
          coverUrl: coverUrl || createTrackArtworkUrl(title || 'New Sound', artist || 'Kinetic Creator'),
          audioUrl: cloudRes.secure_url,
          duration: fileDuration || 180,
          cloudinaryPublicId: cloudRes.public_id,
        });

        clearTrackCache();
        setUploadProgress(100);
        setIsUploading(false);
        setStep(4);
        onUploadSuccess({ title: title || 'New Sound', type: 'track' });
      }
    } catch (err) {
      setIsUploading(false);
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[var(--surface)] border border-[var(--border)] w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[var(--accent)]" />
            <h2 className="text-lg font-bold text-[var(--text)] font-display">
              Creator Studio Upload
            </h2>
          </div>
          <button 
            onClick={() => { resetForm(); onClose(); }}
            className="p-1 text-[var(--subtle)] hover:text-[var(--text)] rounded-full hover:bg-[var(--raised)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">

          {/* STEP 1: Select Type */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--muted)] font-medium">Select the content format you wish to publish to Kinetic:</p>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => { setUploadType('video'); setStep(2); }}
                  className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border transition-all text-center group ${
                    uploadType === 'video' 
                      ? 'bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--text)]'
                      : 'bg-[var(--raised)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] group-hover:scale-110 transition-transform">
                    <Film className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-[var(--text)]">Short Video</div>
                    <div className="text-[10px] text-[var(--subtle)]">9:16 Feed • Max 90s</div>
                  </div>
                </button>

                <button
                  onClick={() => { setUploadType('track'); setStep(2); }}
                  className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border transition-all text-center group ${
                    uploadType === 'track' 
                      ? 'bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--text)]'
                      : 'bg-[var(--raised)] border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl bg-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] group-hover:scale-110 transition-transform">
                    <FileAudio className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold text-sm text-[var(--text)]">Audio Track</div>
                    <div className="text-[10px] text-[var(--subtle)]">MP3 / WAV / FLAC</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: File Picker & Duration Inspection */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-[var(--border)] hover:border-[var(--accent)] rounded-2xl p-8 text-center transition-colors relative cursor-pointer group bg-[var(--raised)]/50">
                <input 
                  type="file" 
                  accept={uploadType === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'audio/mp3,audio/wav,audio/flac'}
                  onChange={handleFileSelect}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
                <div className="w-12 h-12 rounded-full bg-[var(--accent)]/10 flex items-center justify-center text-[var(--accent)] mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="text-sm font-bold text-[var(--text)] mb-1">
                  Drag & Drop or Click to Select File
                </div>
                <div className="text-xs text-[var(--subtle)]">
                  {uploadType === 'video' ? 'MP4, WebM (Max 90 seconds)' : 'MP3, WAV, FLAC'}
                </div>
              </div>

              {/* Analyzing Loader */}
              {isAnalyzing && (
                <div className="flex items-center justify-center gap-2 p-3 bg-[var(--raised)] rounded-xl text-xs font-semibold text-[var(--accent-hover)]">
                  <RefreshCw className="w-4 h-4 animate-spin text-[var(--accent)]" />
                  <span>Inspecting media duration & format...</span>
                </div>
              )}

              {/* Duration Validation Error Banner */}
              {durationError && (
                <div className="p-4 bg-[var(--like)]/15 border border-[var(--like)]/40 rounded-2xl flex items-start gap-3 text-xs text-[var(--danger)] animate-in fade-in">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-[var(--like)]" />
                  <div>
                    <div className="font-bold">Video Duration Error</div>
                    <div>{durationError}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Metadata Form */}
          {step === 3 && file && (
            <div className="space-y-4">
              <div className="p-3 bg-[var(--raised)] rounded-xl flex items-center justify-between border border-[var(--border)]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text)] truncate">
                  <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                  <span className="truncate">{file.name}</span>
                </div>
                <span className="text-[10px] font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded-full">
                  {uploadType === 'video' ? `${Math.round(fileDuration)}s` : 'Audio'}
                </span>
              </div>

              {uploadType === 'video' ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-[var(--muted)] block mb-1">Caption / Description</label>
                    <textarea
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Write a compelling caption for your short video..."
                      rows={3}
                      className="w-full bg-[var(--raised)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--text)] placeholder-[var(--subtle)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[var(--muted)] block mb-1">Hashtags</label>
                    <input
                      type="text"
                      value={hashtags}
                      onChange={(e) => setHashtags(e.target.value)}
                      placeholder="#kinetic #music var(--muted)ts"
                      className="w-full bg-[var(--raised)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--text)] placeholder-[var(--subtle)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-[var(--muted)] block mb-1">Track Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Cyberpunk Horizon"
                      className="w-full bg-[var(--raised)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[var(--muted)] block mb-1">Artist Name</label>
                    <input
                      type="text"
                      value={artist}
                      onChange={(e) => setArtist(e.target.value)}
                      placeholder="e.g. Kaelen Vance"
                      className="w-full bg-[var(--raised)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[var(--muted)] block mb-1">Cover Image URL <span className="font-normal text-[var(--subtle)]">(optional)</span></label>
                    <input
                      type="url"
                      value={coverUrl}
                      onChange={(e) => setCoverUrl(e.target.value)}
                      placeholder="Paste artwork URL or leave blank for generated artwork"
                      className="w-full bg-[var(--raised)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--text)] placeholder-[var(--subtle)] focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[var(--muted)] block mb-1">Genre</label>
                    <select
                      value={genre}
                      onChange={(e) => setGenre(e.target.value)}
                      className="w-full bg-[var(--raised)] border border-[var(--border)] rounded-xl p-3 text-xs text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
                    >
                      <option value="Electronic">Electronic / Synthwave</option>
                      <option value="Ambient">Ambient / Chillout</option>
                      <option value="Hip-Hop">Hip-Hop / Beats</option>
                      <option value="House">House / Techno</option>
                      <option value="Indie">Indie Pop</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Progress & Error Displays */}
              {isUploading && (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-xs font-bold text-[var(--text)]">
                    <span>Uploading</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-[var(--raised)] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent)] transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-[var(--like)]/15 border border-[var(--like)]/40 rounded-xl text-xs text-[var(--danger)]">
                  {errorMessage}
                </div>
              )}

              <button
                disabled={isUploading}
                onClick={handlePublish}
                className="w-full py-3 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent)] hover:brightness-110 text-[var(--text)] font-bold text-xs shadow-lg shadow-[var(--accent)]/30 transition-all flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Publishing Media...</span>
                  </>
                ) : (
                  <>
                    <span>Publish to Kinetic</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 4: Success Card */}
          {step === 4 && (
            <div className="text-center py-6 space-y-4 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-[var(--success)]/20 text-[var(--success)] flex items-center justify-center mx-auto shadow-xl shadow-[var(--success)]/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--text)] font-display">Published to Kinetic!</h3>
                <p className="text-xs text-[var(--muted)] max-w-xs mx-auto">
                  Your media has been successfully processed and published to the platform.
                </p>
              </div>
              <button
                onClick={() => { resetForm(); onClose(); }}
                className="px-6 py-2.5 rounded-full bg-[var(--raised)] text-[var(--text)] font-semibold text-xs border border-[var(--border)] hover:bg-[var(--border-hover)]"
              >
                Close Studio
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
