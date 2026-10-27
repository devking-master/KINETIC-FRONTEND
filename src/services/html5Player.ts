import { Track } from '../types';
import { PlaybackEngine } from './dsa';

const EMPTY_TRACK: Track = {
  id: 'empty-track',
  title: 'No track selected',
  artist: 'Choose a track from Music',
  album: '',
  coverUrl: '',
  duration: 0,
};

export interface PlayerState {
  currentTrack: Track;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffle: boolean;
  isRepeat: boolean;
  queue: Track[];          // the list being played, in play order
  queueIndex: number;      // position of the playlist cursor inside `queue`
  upNext: Track[];         // songs the listener added; they play before the list carries on
  history: Track[];        // recently played, newest first
  hasNext: boolean;
  canGoBack: boolean;
  notice: string | null;   // short message such as 'End of playlist reached'
  spectrumData: Uint8Array;
  isLoading: boolean;
  error: string | null;
}

type Listener = (state: PlayerState) => void;

class HTML5AudioPlayerService {
  private audio: HTMLAudioElement;
  private audioCtx: AudioContext | null = null;
  private analyserNode: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private listeners: Set<Listener> = new Set();
  private engine = new PlaybackEngine<Track>();
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;
  private consecutiveErrors = 0;

  private state: PlayerState = {
    currentTrack: EMPTY_TRACK,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
    isMuted: false,
    isShuffle: false,
    isRepeat: false,
    queue: [],
    queueIndex: 0,
    upNext: [],
    history: [],
    hasNext: false,
    canGoBack: false,
    notice: null,
    spectrumData: new Uint8Array(16).fill(0),
    isLoading: false,
    error: null,
  };

  constructor() {
    this.audio = new Audio();
    this.audio.volume = this.state.volume;

    this.attachAudioListeners();
  }

  private initWebAudio() {
    if (this.audioCtx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtx();
      this.analyserNode = this.audioCtx.createAnalyser();
      this.analyserNode.fftSize = 32;

      this.sourceNode = this.audioCtx.createMediaElementSource(this.audio);
      this.sourceNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioCtx.destination);
    } catch {
      // Cross-origin fallback without spectrum node if CORS policy prevents Web Audio node attachment
    }
  }

  private attachAudioListeners() {
    this.audio.addEventListener('play', () => {
      this.state.isPlaying = true;
      this.state.isLoading = false;
      this.state.error = null;
      this.notify();
    });

    this.audio.addEventListener('pause', () => {
      this.state.isPlaying = false;
      this.notify();
    });

    this.audio.addEventListener('timeupdate', () => {
      this.state.currentTime = this.audio.currentTime;
      this.updateSpectrum();
      this.notify();
    });

    this.audio.addEventListener('loadedmetadata', () => {
      this.state.duration = this.audio.duration || this.state.currentTrack.duration;
      this.state.isLoading = false;
      this.notify();
    });

    this.audio.addEventListener('waiting', () => {
      this.state.isLoading = true;
      this.notify();
    });

    // 'playing' means sound is really coming out: loading is over and the last error is forgotten
    this.audio.addEventListener('playing', () => {
      this.consecutiveErrors = 0;
      this.state.isLoading = false;
      this.state.error = null;
      this.notify();
    });

    this.audio.addEventListener('ended', () => {
      if (this.state.isRepeat) {
        this.audio.currentTime = 0;
        this.audio.play().catch(() => {});
      } else {
        this.nextTrack(); // queue first, then the playlist; stops at the end of the list
      }
    });

    this.audio.addEventListener('error', (e) => {
      console.warn('[Kinetic HTML5 Player] Audio stream unavailable:', e);
      this.state.isLoading = false;
      this.state.isPlaying = false;
      this.state.error = 'Audio source unavailable';
      this.notify();
      this.skipUnplayable();
    });
  }

  // A song that cannot be loaded is skipped (at most 3 in a row, so a dead connection does not race through the list).
  private skipUnplayable() {
    const failedId = this.state.currentTrack.id;
    if (this.consecutiveErrors >= 3 || !this.state.hasNext) {
      this.setNotice('This song could not be loaded');
      this.notify();
      return;
    }
    this.consecutiveErrors++;
    this.setNotice('This song could not be loaded. Skipping to the next one.');
    this.notify();
    setTimeout(() => {
      if (this.state.currentTrack.id === failedId && this.state.error) this.nextTrack();
    }, 1200);
  }

  private updateSpectrum() {
    if (this.analyserNode && this.state.isPlaying) {
      const data = new Uint8Array(this.analyserNode.frequencyBinCount);
      this.analyserNode.getByteFrequencyData(data);
      this.state.spectrumData = data;
    } else {
      // Mock subtle spectrum motion if WebAudio node is dormant
      const mockSpectrum = new Uint8Array(16);
      if (this.state.isPlaying) {
        for (let i = 0; i < 16; i++) {
          mockSpectrum[i] = Math.floor(Math.random() * 180 + 50);
        }
      }
      this.state.spectrumData = mockSpectrum;
    }
  }

  public getState(): PlayerState {
    return { ...this.state };
  }

  public subscribe(cb: Listener): () => void {
    this.listeners.add(cb);
    cb(this.getState());
    return () => this.listeners.delete(cb);
  }

  private notify() {
    const currentState = this.getState();
    this.listeners.forEach((cb) => cb(currentState));
  }

  // Copies what the engine knows (list, cursor, up next, history) into the state the UI reads.
  private syncFromEngine() {
    const snap = this.engine.snapshot();
    this.state.queue = snap.playlist;
    this.state.queueIndex = snap.cursorIndex;
    this.state.upNext = snap.upNext;
    this.state.history = snap.history;
    this.state.hasNext = snap.hasNext;
    this.state.canGoBack = snap.canGoBack;
    this.state.isShuffle = snap.shuffled;
  }

  private setNotice(text: string | null) {
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.state.notice = text;
    if (text) {
      this.noticeTimer = setTimeout(() => {
        this.state.notice = null;
        this.notify();
      }, 2500);
    }
  }

  // The listener pressed play on `track`, optionally from the list of songs they were looking at.
  public playTrack(track: Track, newQueue?: Track[]) {
    // Pressing the song that is already loaded is play/pause, not "start it again from 0".
    const alreadyLoaded =
      this.state.currentTrack.id === track.id &&
      !this.state.error &&
      !!this.audio.src &&
      this.audio.src !== 'about:blank';

    if (alreadyLoaded) {
      if (newQueue && newQueue.length > 0) {
        this.engine.adoptContext(track, newQueue); // keep the page's list in sync (for example after sorting)
        this.syncFromEngine();
        this.notify();
      }
      this.togglePlay();
      return;
    }

    this.engine.playFrom(track, newQueue);
    this.startAudio(track);
  }

  // Audio side of starting a song. Which song comes next is decided by the engine, not here.
  private startAudio(track: Track) {
    this.setNotice(null);
    this.syncFromEngine();

    this.state.currentTrack = track;
    this.state.duration = track.duration;
    this.state.currentTime = 0;
    this.state.isLoading = true;
    this.state.error = null;

    if (track.audioUrl) {
      this.audio.src = track.audioUrl;
      this.audio.load();
      this.audio.play().catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.warn('[HTML5 Player] Audio playback did not start:', err.message);
        this.state.isPlaying = false;
        this.state.isLoading = false;
        this.state.error = 'Audio playback could not start';
        this.notify();
      });
    } else {
      this.state.isLoading = false;
      this.state.error = 'This track has no playable audio source';
      this.skipUnplayable();
    }

    this.notify();
  }

  public togglePlay() {
    if (this.state.currentTrack.id === 'empty-track') return;
    if (this.state.isPlaying) {
      this.audio.pause();
    } else {
      if (!this.audio.src || this.audio.src === 'about:blank') {
        this.startAudio(this.state.currentTrack);
      } else {
        this.audio.play().catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          console.warn('[HTML5 Player] Audio playback did not start:', err.message);
          this.state.error = 'Audio playback could not start';
          this.notify();
        });
      }
    }
  }

  public seek(seconds: number) {
    if (this.audio && !isNaN(seconds)) {
      this.audio.currentTime = seconds;
      this.state.currentTime = seconds;
      this.notify();
    }
  }

  public setVolume(val: number) {
    const clamped = Math.max(0, Math.min(1, val));
    this.state.volume = clamped;
    this.audio.volume = this.state.isMuted ? 0 : clamped;
    this.notify();
  }

  public toggleMute() {
    this.state.isMuted = !this.state.isMuted;
    this.audio.volume = this.state.isMuted ? 0 : this.state.volume;
    this.notify();
  }

  public toggleShuffle() {
    this.engine.setShuffle(!this.engine.isShuffled());
    this.syncFromEngine();
    this.notify();
  }

  public toggleRepeat() {
    this.state.isRepeat = !this.state.isRepeat;
    this.notify();
  }

  // Next: songs the listener queued first, then the next song in the list. At the last song it stops.
  public nextTrack() {
    const result = this.engine.next();
    if (result.reason === 'played' && result.track) {
      this.startAudio(result.track);
      return;
    }
    if (result.reason === 'end-of-playlist') {
      this.setNotice('End of playlist reached');
      this.notify();
    }
  }

  // Previous: restart if the song has played for more than 3 seconds, otherwise go back one.
  public previousTrack() {
    const result = this.engine.previous(this.state.currentTime);
    if (result.reason === 'empty') return;

    if (result.reason === 'played' && result.changed && result.track) {
      this.startAudio(result.track);
      return;
    }

    // restarted, or already at the first song
    this.seek(0);
    if (!this.state.isPlaying) {
      this.audio.play().catch(() => {});
    }
    if (result.reason === 'start-of-playlist') {
      this.setNotice('Beginning of playlist reached');
      this.notify();
    }
  }

  // Add to queue: plays after the current song, before the list carries on.
  public enqueue(track: Track) {
    if (this.state.currentTrack.id === 'empty-track') {
      this.playTrack(track);
      return;
    }
    this.engine.enqueue(track);
    this.syncFromEngine();
    this.setNotice(`Added to queue: ${track.title}`);
    this.notify();
  }

  public removeFromUpNext(trackId: string) {
    this.engine.removeFromUpNext(trackId);
    this.syncFromEngine();
    this.notify();
  }

  public clearUpNext() {
    this.engine.clearUpNext();
    this.syncFromEngine();
    this.notify();
  }
}

export const html5Player = new HTML5AudioPlayerService();
