import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ImagePlus, Loader2, Users } from '../ui/Icon';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { AuthUser } from '../../types';
import { onboardingApi, OnboardingOption, SuggestedCreator } from '../../services/onboardingApi';
import { authApi } from '../../services/authApi';
import { uploadApi } from '../../services/uploadApi';
import { clearTrackCache, musicApi } from '../../services/musicApi';
import { KineticLogo } from '../KineticLogo';

interface OnboardingViewProps {
  user: AuthUser;
  onUserUpdated: (user: AuthUser) => void;
  onComplete: () => void;
}

interface FlowState {
  step: number;
  roleMode: 'listener' | 'creator' | 'both';
  genres: string[];
  topics: string[];
  name: string;
  bio: string;
  avatarUrl: string;
  followedIds: string[];
}

const STORAGE_KEY = 'kinetic.onboarding';
const fallbackGenres = ['ambient', 'electronic', 'hip hop', 'jazz', 'pop', 'rock', 'soul', 'world'];
const fallbackTopics = ['music', 'dance', 'comedy', 'gaming', 'art', 'fashion', 'fitness', 'travel'];

const initialFlow = (user: AuthUser): FlowState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<FlowState>;
      return {
        step: Math.max(0, Math.min(4, Number(parsed.step) || 0)),
        roleMode: parsed.roleMode || (user.role === 'listener' ? 'listener' : 'creator'),
        genres: parsed.genres || user.interests?.genres || [],
        topics: parsed.topics || user.interests?.topics || [],
        name: parsed.name ?? user.name,
        bio: parsed.bio ?? user.bio ?? '',
        avatarUrl: parsed.avatarUrl ?? user.avatarUrl ?? '',
        followedIds: parsed.followedIds || [],
      };
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return {
    step: 0,
    roleMode: user.role === 'listener' ? 'listener' : 'creator',
    genres: user.interests?.genres || [],
    topics: user.interests?.topics || [],
    name: user.name,
    bio: user.bio || '',
    avatarUrl: user.avatarUrl || '',
    followedIds: [],
  };
};

const variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction * 38, y: 8 }),
  center: { opacity: 1, x: 0, y: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction * -38, y: -4 }),
};

const optionContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.04 } },
};
const optionItem = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.22 } },
};

export const OnboardingView: React.FC<OnboardingViewProps> = ({ user, onUserUpdated, onComplete }) => {
  const [flow, setFlow] = useState(() => initialFlow(user));
  const [direction, setDirection] = useState(1);
  const [options, setOptions] = useState<{ genres: OnboardingOption[]; topics: OnboardingOption[] }>({ genres: [], topics: [] });
  const [creators, setCreators] = useState<SuggestedCreator[]>([]);
  const [creatorCounts, setCreatorCounts] = useState<Record<string, number>>({});
  const [isLoadingCreators, setIsLoadingCreators] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [error, setError] = useState('');
  const [uploadError, setUploadError] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reducedMotion = useReducedMotion();
  const staggeredOptionItem = reducedMotion
    ? { hidden: { opacity: 0, y: 0 }, visible: { opacity: 1, y: 0, transition: { duration: 0.12 } } }
    : optionItem;
  const checkVariants = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, scale: 0.7 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.7 } };
  const transitionVariants = reducedMotion
    ? { enter: { opacity: 0, x: 0, y: 0 }, center: { opacity: 1, x: 0, y: 0 }, exit: { opacity: 0, x: 0, y: 0 } }
    : variants;

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(flow)); } catch { /* Storage may be unavailable. */ }
  }, [flow]);

  useEffect(() => {
    let cancelled = false;
    onboardingApi.getOptions().then((result) => { if (!cancelled) setOptions(result); }).catch(() => {
      if (!cancelled) setOptions({
        genres: fallbackGenres.map((key) => ({ key, label: key.replace(/\b\w/g, (letter) => letter.toUpperCase()), count: 0 })),
        topics: fallbackTopics.map((key) => ({ key, label: key.replace(/\b\w/g, (letter) => letter.toUpperCase()), count: 0 })),
      });
    });
    onboardingApi.getSuggestedCreators().then((result) => { if (!cancelled) setCreators(result); }).catch(() => {
      if (!cancelled) setCreators([]);
    }).finally(() => { if (!cancelled) setIsLoadingCreators(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { headingRef.current?.focus(); }, [flow.step]);

  const updateFlow = (patch: Partial<FlowState>) => setFlow((previous) => ({ ...previous, ...patch }));
  const advance = () => {
    if (flow.step === 2 && flow.genres.length > 0 && flow.genres.length < 3) return;
    if (flow.step === 3 && flow.topics.length > 0 && flow.topics.length < 3) return;
    setDirection(1);
    updateFlow({ step: Math.min(4, flow.step + 1) });
  };
  const goBack = () => {
    if (flow.step === 0) return;
    setDirection(-1);
    updateFlow({ step: flow.step - 1 });
  };

  const finish = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setIsSettingUp(true);
    setError('');
    try {
      const updatedUser = await onboardingApi.save({
        genres: flow.genres,
        topics: flow.topics,
        role: flow.roleMode === 'listener' ? 'listener' : 'creator',
        name: flow.name.trim() || user.name,
        bio: flow.bio.trim(),
        avatarUrl: flow.avatarUrl,
        completed: true,
      });
      onUserUpdated(updatedUser);
      clearTrackCache();
      await Promise.race([
        musicApi.getRecommended().catch(() => null),
        new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1200)),
      ]);
      localStorage.removeItem(STORAGE_KEY);
      setIsFinished(true);
      window.setTimeout(onComplete, 320);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to finish setup. Try again.');
      setIsSettingUp(false);
      setIsSaving(false);
    }
  };

  const skipCurrentStep = () => {
    if (flow.step === 4) void finish();
    else {
      setDirection(1);
      updateFlow({
        step: flow.step + 1,
        ...(flow.step === 2 && flow.genres.length < 3 ? { genres: [] } : {}),
        ...(flow.step === 3 && flow.topics.length < 3 ? { topics: [] } : {}),
      });
    }
  };

  const toggleOption = (field: 'genres' | 'topics', key: string) => {
    const selected = flow[field];
    const next = selected.includes(key)
      ? selected.filter((value) => value !== key)
      : selected.length < 8 ? [...selected, key] : selected;
    updateFlow({ [field]: next } as Pick<FlowState, typeof field>);
  };

  const handleAvatarUpload = async (file?: File) => {
    if (!file) return;
    setIsUploading(true);
    setUploadError('');
    try {
      const uploaded = await uploadApi.uploadFileToCloudinary(file, 'image', undefined, 'avatar');
      updateFlow({ avatarUrl: uploaded.secure_url });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const toggleFollow = async (creator: SuggestedCreator) => {
    const alreadyFollowing = flow.followedIds.includes(creator.id);
    const delta = alreadyFollowing ? -1 : 1;
    updateFlow({ followedIds: alreadyFollowing ? flow.followedIds.filter((id) => id !== creator.id) : [...flow.followedIds, creator.id] });
    setCreatorCounts((counts) => ({ ...counts, [creator.id]: Math.max(0, (counts[creator.id] ?? creator.followersCount) + delta) }));
    try {
      const result = await authApi.toggleFollow(creator.id);
      if (result.following === alreadyFollowing) {
        updateFlow({ followedIds: result.following ? [...flow.followedIds, creator.id] : flow.followedIds.filter((id) => id !== creator.id) });
        setCreatorCounts((counts) => ({ ...counts, [creator.id]: Math.max(0, (counts[creator.id] ?? creator.followersCount) - delta) }));
      }
    } catch {
      updateFlow({ followedIds: alreadyFollowing ? [...flow.followedIds, creator.id] : flow.followedIds.filter((id) => id !== creator.id) });
      setCreatorCounts((counts) => ({ ...counts, [creator.id]: Math.max(0, (counts[creator.id] ?? creator.followersCount) - delta) }));
    }
  };

  const selectedGenreOptions = options.genres.length ? options.genres : fallbackGenres.map((key) => ({ key, label: key, count: 0 }));
  const selectedTopicOptions = options.topics.length ? options.topics : fallbackTopics.map((key) => ({ key, label: key, count: 0 }));
  const selectionBlocked = (flow.step === 2 && flow.genres.length > 0 && flow.genres.length < 3)
    || (flow.step === 3 && flow.topics.length > 0 && flow.topics.length < 3);
  const stepTitle = ['Pick a photo', 'How will you use Kinetic?', 'What do you listen to?', 'What do you like watching?', 'Follow a few creators'][flow.step];

  const chipGroup = (field: 'genres' | 'topics', items: OnboardingOption[]) => {
    const selected = flow[field];
    return <>
      <motion.div className="flex flex-wrap gap-2" variants={optionContainer} initial="hidden" animate="visible">
        {items.map((item) => {
          const pressed = selected.includes(item.key);
          return <motion.button
            key={item.key}
            type="button"
            variants={staggeredOptionItem}
            whileTap={reducedMotion ? undefined : { scale: 0.96 }}
            aria-pressed={pressed}
            onClick={() => toggleOption(field, item.key)}
            disabled={!pressed && selected.length >= 8}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-hover)] disabled:opacity-45 ${pressed ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text)]' : 'border-[var(--border)] bg-[var(--raised)] text-[var(--muted)] hover:border-[var(--border-hover)] hover:text-[var(--text)]'}`}
          >
            <AnimatePresence initial={false}>{pressed && <motion.span {...checkVariants}><Check className="h-3.5 w-3.5" /></motion.span>}</AnimatePresence>
            {item.label}
          </motion.button>;
        })}
      </motion.div>
      <p className="mt-4 text-xs text-[var(--muted)]" aria-live="polite">{selected.length} of 8 selected{selected.length > 0 && selected.length < 3 ? ' · Pick at least 3 or clear your selection' : ''}</p>
    </>;
  };

  const stepContent = () => {
    if (isSettingUp) return <div className="flex min-h-[360px] flex-col items-center justify-center text-center">
      {isFinished ? <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
        <motion.svg viewBox="0 0 72 72" className="mx-auto h-16 w-16 text-[var(--success)]" aria-label="Setup complete" role="img">
          <motion.circle cx="36" cy="36" r="31" fill="none" stroke="currentColor" strokeWidth="3" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: reducedMotion ? 0 : 0.55 }} />
          <motion.path d="m20 37 10 10 22-23" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: reducedMotion ? 0 : 0.25, duration: reducedMotion ? 0 : 0.35 }} />
        </motion.svg>
        <h2 className="mt-5 text-xl font-bold">Your feed is ready</h2>
      </motion.div> : <><Loader2 className="h-8 w-8 animate-spin text-[var(--accent-hover)]" /><h2 className="mt-5 text-lg font-bold">Setting up your feed</h2><p className="mt-2 text-sm text-[var(--muted)]">Saving your choices and finding a few recommendations.</p></>}
    </div>;

    if (flow.step === 0) return <div className="space-y-6">
      <div className="flex flex-col items-center gap-4">
        <AnimatePresence mode="wait"><motion.div key={flow.avatarUrl || 'default'} initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }} className="relative">
          <Avatar src={flow.avatarUrl} name={flow.name} size={104} className="ring-4 ring-[var(--accent-soft)]" />
          {isUploading && <span aria-label="Uploading photo" className="absolute inset-[-5px] animate-spin rounded-full border-2 border-transparent border-t-[var(--accent)] border-r-[var(--accent)]" />}
        </motion.div></AnimatePresence>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--raised)] px-4 py-2.5 text-xs font-semibold hover:border-[var(--accent)]">
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {isUploading ? 'Uploading photo' : 'Upload a photo'}
          <input type="file" accept="image/*" className="sr-only" disabled={isUploading} onChange={(event) => { void handleAvatarUpload(event.target.files?.[0]); event.currentTarget.value = ''; }} />
        </label>
      </div>
      <div className="space-y-4">
        <label className="block text-xs font-semibold text-[var(--muted)]">Display name<input value={flow.name} maxLength={50} onChange={(event) => updateFlow({ name: event.target.value })} className="mt-2 h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none" /></label>
        <label className="block text-xs font-semibold text-[var(--muted)]">Short bio<textarea value={flow.bio} maxLength={150} onChange={(event) => updateFlow({ bio: event.target.value })} rows={3} className="mt-2 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none" /><span className="mt-1 block text-right text-[11px]">{flow.bio.length}/150</span></label>
      </div>
      {uploadError && <p role="alert" className="text-xs text-[var(--danger)]">{uploadError}</p>}
    </div>;

    if (flow.step === 1) return <motion.div className="grid gap-3" variants={optionContainer} initial="hidden" animate="visible">
      {([
        { key: 'listener', title: 'Listen and watch', detail: 'Find music and videos to enjoy.' },
        { key: 'creator', title: 'Share my own music and videos', detail: 'Publish your work and reach an audience.' },
        { key: 'both', title: 'Both', detail: 'Create, discover, and follow creators.' },
      ] as const).map((item) => <motion.button key={item.key} variants={staggeredOptionItem} type="button" onClick={() => updateFlow({ roleMode: item.key })} aria-pressed={flow.roleMode === item.key} className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition duration-150 motion-safe:hover:-translate-y-0.5 ${flow.roleMode === item.key ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border)] bg-[var(--raised)] hover:border-[var(--border-hover)]'}`}>
        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${flow.roleMode === item.key ? 'border-[var(--accent)]' : 'border-[var(--muted)]'}`}>{flow.roleMode === item.key && <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />}</span>
        <span><span className="block text-sm font-bold">{item.title}</span><span className="mt-1 block text-xs text-[var(--muted)]">{item.detail}</span></span>
      </motion.button>)}
    </motion.div>;

    if (flow.step === 2) return <div>{chipGroup('genres', selectedGenreOptions)}</div>;
    if (flow.step === 3) return <div>{chipGroup('topics', selectedTopicOptions)}</div>;

    if (isLoadingCreators) return <div className="flex min-h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--accent-hover)]" /></div>;
    if (creators.length < 3) return <div className="flex min-h-48 flex-col items-center justify-center text-center"><Users className="h-8 w-8 text-[var(--muted)]" /><p className="mt-3 text-sm font-semibold">There are not enough creators to suggest yet.</p><p className="mt-1 text-xs text-[var(--muted)]">You can continue and find creators later.</p></div>;
    return <div className="grid gap-2 sm:grid-cols-2">
      {creators.map((creator) => {
        const followed = flow.followedIds.includes(creator.id);
        return <div key={creator.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--raised)] p-3">
          <Avatar src={creator.avatarUrl} name={creator.name} size={40} />
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{creator.name}</p><p className="truncate text-[11px] text-[var(--muted)]">@{creator.username}</p><p className="text-[10px] text-[var(--muted)]">{(creatorCounts[creator.id] ?? creator.followersCount).toLocaleString()} followers</p></div>
          <Button type="button" onClick={() => void toggleFollow(creator)} className={`h-8 shrink-0 px-3 text-[11px] ${followed ? 'border border-[var(--border)] bg-transparent text-[var(--text)]' : ''}`}>
            <AnimatePresence mode="wait" initial={false}><motion.span key={followed ? 'following' : 'follow'} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -3 }} className="inline-flex items-center gap-1">{followed && <Check className="h-3.5 w-3.5" />}{followed ? 'Following' : 'Follow'}</motion.span></AnimatePresence>
          </Button>
        </div>;
      })}
    </div>;
  };

  const continueAction = () => {
    if (selectionBlocked) return;
    if (flow.step === 4) void finish();
    else advance();
  };

  return <main className="fixed inset-0 z-[80] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-[var(--bg)] px-0 py-0 sm:p-6" onKeyDown={(event) => {
    if (event.key === 'Enter' && (event.target === event.currentTarget || event.target === headingRef.current)) { event.preventDefault(); continueAction(); }
  }}>
    <div aria-hidden="true" className="pointer-events-none fixed inset-0" style={{ backgroundImage: 'radial-gradient(ellipse at 50% -20%, rgba(99,102,241,.12), transparent 52%), repeating-linear-gradient(45deg, transparent 0 42px, rgba(255,255,255,.018) 43px 44px)' }} />
    <motion.section layout className="relative flex min-h-[100dvh] w-full max-w-[520px] flex-col overflow-hidden border border-[var(--border)] bg-[var(--surface)] shadow-2xl sm:min-h-0 sm:max-h-[calc(100dvh-48px)] sm:rounded-3xl">
      <header className="flex shrink-0 items-center gap-4 px-5 pt-[max(20px,env(safe-area-inset-top))] sm:px-7 sm:pt-6">
        <a href="/" aria-label="Kinetic home" className="shrink-0"><KineticLogo showText={false} size="sm" /></a>
        <div className="flex flex-1 items-center gap-1.5" aria-hidden="true">{[0, 1, 2, 3, 4].map((item) => <div key={item} className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]"><motion.div className="h-full rounded-full bg-[var(--accent)]" animate={{ width: item <= flow.step ? '100%' : '0%' }} transition={{ duration: reducedMotion ? 0 : 0.4 }} /></div>)}</div>
        {!isSettingUp && <button type="button" onClick={skipCurrentStep} className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)]">Skip</button>}
      </header>

      {!isSettingUp && flow.step > 0 && <button type="button" onClick={goBack} className="ml-5 mt-3 inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)] sm:ml-7"><ArrowLeft className="h-4 w-4" /> Back</button>}
      <div className="flex min-h-0 flex-1 flex-col px-5 pb-32 pt-5 sm:px-7 sm:pb-6">
        <div className="mb-5" aria-live="polite"><p className="text-[11px] font-semibold text-[var(--muted)]">{isSettingUp ? '' : `Step ${flow.step + 1} of 5`}</p>
          {!isSettingUp && <h1 ref={headingRef} tabIndex={-1} className="mt-1 text-xl font-bold tracking-normal text-[var(--text)] focus:outline-none">{stepTitle}</h1>}
        </div>
        {error && <p role="alert" className="mb-3 text-xs text-[var(--danger)]">{error}</p>}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div key={isSettingUp ? 'setting-up' : flow.step} layout custom={reducedMotion ? 0 : direction} variants={transitionVariants} initial="enter" animate="center" exit="exit" transition={{ layout: { duration: reducedMotion ? 0 : 0.3 }, opacity: { duration: reducedMotion ? 0.12 : 0.28 }, x: { duration: reducedMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }, y: { duration: reducedMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] } }}>
              {stepContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {!isSettingUp && <footer className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--border)] bg-[var(--surface)] px-5 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 sm:static sm:mt-auto sm:border-0 sm:bg-transparent sm:px-7 sm:pb-6 sm:pt-2">
        <div className="mx-auto flex w-full max-w-[520px] items-center gap-3 sm:max-w-none">
          <button type="button" onClick={() => void finish()} className="shrink-0 rounded-lg px-2 py-3 text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)]">Skip setup</button>
          <Button type="button" disabled={selectionBlocked || isUploading || isSaving} onClick={continueAction} className="h-11 flex-1 justify-center gap-2 rounded-lg text-sm">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {flow.step === 4 ? 'Finish' : 'Continue'}
            {!isSaving && <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </footer>}
    </motion.section>
  </main>;
};
