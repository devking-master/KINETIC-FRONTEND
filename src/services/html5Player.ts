import { Track } from '../types';

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
  queue: Track[];
  queueIndex: number;
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

    this.audio.addEventListener('ended', () => {
      if (this.state.isRepeat) {
        this.audio.currentTime = 0;
        this.audio.play().catch(() => {});
      } else {
        this.nextTrack();
      }
    });

    this.audio.addEventListener('error', (e) => {
      console.warn('[Kinetic HTML5 Player] Audio stream unavailable:', e);
      this.state.isLoading = false;
      this.state.isPlaying = false;
      this.state.error = 'Audio source unavailable';
      this.notify();
    });
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

  public playTrack(track: Track, newQueue?: Track[]) {
    if (newQueue && newQueue.length > 0) {
      this.state.queue = newQueue;
      const idx = newQueue.findIndex((t) => t.id === track.id);
      this.state.queueIndex = idx !== -1 ? idx : 0;
    } else {
      const idx = this.state.queue.findIndex((t) => t.id === track.id);
      if (idx === -1) {
        this.state.queue.push(track);
        this.state.queueIndex = this.state.queue.length - 1;
      } else {
        this.state.queueIndex = idx;
      }
    }

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
    }

    this.notify();
  }

  public togglePlay() {
    if (this.state.isPlaying) {
      this.audio.pause();
    } else {
      if (!this.audio.src || this.audio.src === 'about:blank') {
        this.playTrack(this.state.currentTrack);
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
    this.state.isShuffle = !this.state.isShuffle;
    this.notify();
  }

  public toggleRepeat() {
    this.state.isRepeat = !this.state.isRepeat;
    this.notify();
  }

  public nextTrack() {
    if (this.state.queue.length === 0) return;

    let nextIdx = this.state.queueIndex + 1;
    if (this.state.isShuffle) {
      nextIdx = Math.floor(Math.random() * this.state.queue.length);
    } else if (nextIdx >= this.state.queue.length) {
      nextIdx = 0;
    }

    const nextTrack = this.state.queue[nextIdx];
    if (nextTrack) {
      this.playTrack(nextTrack);
    }
  }

  public previousTrack() {
    if (this.state.currentTime > 3) {
      this.seek(0);
      return;
    }

    if (this.state.queue.length === 0) return;

    let prevIdx = this.state.queueIndex - 1;
    if (prevIdx < 0) {
      prevIdx = this.state.queue.length - 1;
    }

    const prevTrack = this.state.queue[prevIdx];
    if (prevTrack) {
      this.playTrack(prevTrack);
    }
  }
}

export const html5Player = new HTML5AudioPlayerService();
