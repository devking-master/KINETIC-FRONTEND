import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Track } from '../types';

// A stand-in for the browser's audio element that records what the player asks it to do.
class FakeAudio {
  src = '';
  currentTime = 0;
  volume = 1;
  duration = 0;
  paused = true;
  loads = 0;
  private handlers: Record<string, Array<() => void>> = {};
  addEventListener(name: string, fn: () => void) { (this.handlers[name] = this.handlers[name] || []).push(fn); }
  emit(name: string) { (this.handlers[name] || []).forEach((fn) => fn()); }
  load() { this.loads++; }
  play() { this.paused = false; this.emit('play'); return Promise.resolve(); }
  pause() { this.paused = true; this.emit('pause'); }
}

const track = (id: string, duration = 200): Track => ({
  id, title: `Song ${id}`, artist: 'Artist', album: '', coverUrl: '', duration, audioUrl: `https://cdn.example/${id}.mp3`,
});
const [A, B, C, D, E] = ['a', 'b', 'c', 'd', 'e'].map((id) => track(id));
const LIST = [A, B, C, D, E];

let audio: FakeAudio;
let player: typeof import('./html5Player').html5Player;
const idsOf = (list: Track[]) => list.map((t) => t.id).join(',');

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules();
  audio = new FakeAudio();
  vi.stubGlobal('Audio', function () { return audio; });
  player = (await import('./html5Player')).html5Player;
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('html5Player follows the Spotify Lite algorithm', () => {
  it('playing from a list loads that list, starts the song and logs it', () => {
    player.playTrack(C, LIST);
    const s = player.getState();
    expect(s.currentTrack.id).toBe('c');
    expect(audio.src).toBe('https://cdn.example/c.mp3');
    expect(idsOf(s.queue)).toBe('a,b,c,d,e');
    expect(s.queueIndex).toBe(2);
    expect(idsOf(s.history)).toBe('c');
    expect(s.hasNext).toBe(true);
    expect(s.isPlaying).toBe(true);
  });

  it('next and previous walk the list; the ends stop with a message instead of wrapping', () => {
    player.playTrack(A, LIST);
    player.previousTrack();
    expect(player.getState().currentTrack.id).toBe('a');
    expect(player.getState().notice).toBe('Beginning of playlist reached');

    player.nextTrack(); player.nextTrack();
    expect(player.getState().currentTrack.id).toBe('c');
    player.previousTrack();
    expect(player.getState().currentTrack.id).toBe('b');

    player.nextTrack(); player.nextTrack(); player.nextTrack();
    expect(player.getState().currentTrack.id).toBe('e');
    player.nextTrack();
    expect(player.getState().currentTrack.id).toBe('e');
    expect(player.getState().notice).toBe('End of playlist reached');
    expect(player.getState().hasNext).toBe(false);

    vi.advanceTimersByTime(3000);
    expect(player.getState().notice).toBeNull();
  });

  it('previous restarts the song after 3 seconds of playing', () => {
    player.playTrack(A, LIST);
    player.nextTrack();
    audio.currentTime = 12;
    audio.emit('timeupdate');
    player.previousTrack();
    expect(player.getState().currentTrack.id).toBe('b');
    expect(audio.currentTime).toBe(0);
  });

  it('a finished song moves on by itself, and the last song just stops', () => {
    player.playTrack(D, LIST);
    audio.emit('ended');
    expect(player.getState().currentTrack.id).toBe('e');
    audio.pause();
    audio.emit('ended');
    expect(player.getState().currentTrack.id).toBe('e');
    expect(player.getState().isPlaying).toBe(false);
    expect(player.getState().notice).toBe('End of playlist reached');
  });

  it('repeat replays the same song without logging it again', () => {
    player.playTrack(B, LIST);
    player.toggleRepeat();
    audio.currentTime = 100;
    audio.emit('ended');
    expect(audio.currentTime).toBe(0);
    expect(idsOf(player.getState().history)).toBe('b');
  });

  it('pause and resume do not add to the history; a new song does', () => {
    player.playTrack(A, LIST);
    audio.pause();
    player.togglePlay();
    player.togglePlay();
    player.togglePlay();
    expect(idsOf(player.getState().history)).toBe('a');
    player.nextTrack();
    expect(idsOf(player.getState().history)).toBe('b,a');
  });

  it('add to queue: queued songs play first, in order, then the list carries on', () => {
    player.playTrack(A, LIST);
    player.enqueue(D);
    player.enqueue(E);
    expect(idsOf(player.getState().upNext)).toBe('d,e');
    expect(player.getState().notice).toBe('Added to queue: Song e');

    player.nextTrack();
    expect(player.getState().currentTrack.id).toBe('d');
    expect(idsOf(player.getState().upNext)).toBe('e');
    player.nextTrack();
    expect(player.getState().currentTrack.id).toBe('e');
    player.nextTrack();
    expect(player.getState().currentTrack.id).toBe('b');     // the list continues after A
    expect(idsOf(player.getState().history)).toBe('b,e,d,a');
  });

  it('previous after queued songs goes back through them and then to the song before the queue', () => {
    player.playTrack(A, LIST);
    player.enqueue(D); player.enqueue(E);
    player.nextTrack(); player.nextTrack();                  // d, e
    player.previousTrack();
    expect(player.getState().currentTrack.id).toBe('d');
    player.previousTrack();
    expect(player.getState().currentTrack.id).toBe('a');
    expect(audio.src).toBe('https://cdn.example/a.mp3');
  });

  it('queue items can be removed or cleared', () => {
    player.playTrack(A, LIST);
    player.enqueue(B); player.enqueue(C); player.enqueue(D);
    player.removeFromUpNext('c');
    expect(idsOf(player.getState().upNext)).toBe('b,d');
    player.clearUpNext();
    expect(player.getState().upNext.length).toBe(0);
  });

  it('with nothing playing, add to queue just starts that song', () => {
    player.enqueue(C);
    expect(player.getState().currentTrack.id).toBe('c');
    expect(player.getState().upNext.length).toBe(0);
  });

  it('shuffle keeps the current song, plays each other song once; turning it off restores the order', () => {
    player.playTrack(C, LIST);
    player.toggleShuffle();
    const s = player.getState();
    expect(s.isShuffle).toBe(true);
    expect(s.currentTrack.id).toBe('c');
    expect(s.queue[0].id).toBe('c');
    expect([...s.queue].map((t) => t.id).sort().join(',')).toBe('a,b,c,d,e');

    const seen: string[] = [];
    for (let i = 0; i < 4; i++) { player.nextTrack(); seen.push(player.getState().currentTrack.id); }
    expect(new Set(seen).size).toBe(4);
    expect(seen).not.toContain('c');

    player.toggleShuffle();
    expect(player.getState().isShuffle).toBe(false);
    expect(idsOf(player.getState().queue)).toBe('a,b,c,d,e');
    expect(player.getState().currentTrack.id).toBe(seen[3]);
  });

  it('pressing the song that is already playing pauses it, and pressing it again resumes (it does not restart)', () => {
    player.playTrack(B, LIST);
    const loadsAfterStart = audio.loads;
    audio.currentTime = 42;
    player.playTrack(B, LIST);                         // same song again
    expect(audio.paused).toBe(true);
    expect(player.getState().isPlaying).toBe(false);
    expect(audio.currentTime).toBe(42);                // not rewound
    expect(audio.loads).toBe(loadsAfterStart);         // not reloaded
    player.playTrack(B, LIST);
    expect(audio.paused).toBe(false);
    expect(player.getState().isPlaying).toBe(true);
    expect(idsOf(player.getState().history)).toBe('b'); // never logged again
  });

  it('pressing the playing song with a new list (for example after sorting) keeps playing and updates the list', () => {
    player.playTrack(B, LIST);
    const sorted = [E, D, B, A, C];
    player.playTrack(B, sorted);                       // toggles to paused, but the list is now the sorted one
    expect(idsOf(player.getState().queue)).toBe('e,d,b,a,c');
    expect(player.getState().queueIndex).toBe(2);
    player.playTrack(B, sorted);                       // resume
    player.nextTrack();
    expect(player.getState().currentTrack.id).toBe('a');
  });

  it('a different song after a pause starts that song', () => {
    player.playTrack(B, LIST);
    player.playTrack(B, LIST);                         // paused
    player.playTrack(C, LIST);
    expect(player.getState().currentTrack.id).toBe('c');
    expect(audio.paused).toBe(false);
  });

  it('a song that fails to load says so and skips to the next one; three failures in a row stop the skipping', () => {
    player.playTrack(A, LIST);
    audio.emit('error');
    expect(player.getState().notice).toBe('This song could not be loaded. Skipping to the next one.');
    vi.advanceTimersByTime(1300);
    expect(player.getState().currentTrack.id).toBe('b');
    audio.emit('error'); vi.advanceTimersByTime(1300);
    expect(player.getState().currentTrack.id).toBe('c');
    audio.emit('error'); vi.advanceTimersByTime(1300);
    expect(player.getState().currentTrack.id).toBe('d');
    audio.emit('error'); vi.advanceTimersByTime(1300);
    expect(player.getState().currentTrack.id).toBe('d');          // 3 skips used up: stays and tells the listener
    expect(player.getState().notice).toBe('This song could not be loaded');
  });

  it('a song that plays properly resets the failure count', () => {
    player.playTrack(A, LIST);
    audio.emit('error'); vi.advanceTimersByTime(1300);            // now b
    audio.emit('playing');
    expect(player.getState().error).toBeNull();
    audio.emit('error'); vi.advanceTimersByTime(1300);
    audio.emit('error'); vi.advanceTimersByTime(1300);
    audio.emit('error'); vi.advanceTimersByTime(1300);
    expect(player.getState().currentTrack.id).toBe('e');
  });

  it('does not skip past the end of the list when the last song fails', () => {
    player.playTrack(E, LIST);
    audio.emit('error'); vi.advanceTimersByTime(1300);
    expect(player.getState().currentTrack.id).toBe('e');
    expect(player.getState().notice).toBe('This song could not be loaded');
  });

  it('a song with no audio link is skipped too', () => {
    const broken = { ...B, audioUrl: '' } as Track;
    player.playTrack(A, [A, broken, C]);
    player.nextTrack();                                           // b has no audio
    expect(player.getState().error).toBe('This track has no playable audio source');
    vi.advanceTimersByTime(1300);
    expect(player.getState().currentTrack.id).toBe('c');
  });

  it('the play button does nothing while no song has been chosen', () => {
    player.togglePlay();
    expect(audio.paused).toBe(true);
    expect(player.getState().currentTrack.id).toBe('empty-track');
  });
});
