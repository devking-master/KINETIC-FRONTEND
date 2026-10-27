import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { HistoryStack } from './historyStack';
import { UpNextQueue } from './upNextQueue';
import { Playlist } from './playlist';
import { TrackLibrary } from './trackLibrary';
import { PlaybackEngine } from './playbackEngine';
import { isPalindrome, capitalizeTitle, sumDurations, findLongestSong } from './algorithms';

interface S { id: string; title: string; artist: string; duration: number }
const song = (id: string, title: string, duration: number, artist = 'Artist'): S => ({ id, title, artist, duration });
const A = song('a', 'Essence', 204, 'Wizkid');
const B = song('b', 'Last Last', 172, 'Burna Boy');
const C = song('c', 'Calm Down', 219, 'Rema');
const D = song('d', 'Love Nwantiti', 189, 'CKay');
const E = song('e', 'Bandana', 178, 'Fireboy DML');
const ids = (list: S[]) => list.map((s) => s.id).join(',');

// repeatable random numbers for the shuffle tests
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

describe('the structure files follow the coursework rule: no native array methods', () => {
  const FORBIDDEN = /\.(push|pop|shift|unshift|splice|slice|concat|map|filter|forEach|reduce|find|findIndex|some|every|sort|reverse|flat|flatMap|fill|join)\(/;
  for (const file of ['historyStack', 'upNextQueue', 'playlist', 'trackLibrary', 'algorithms']) {
    it(`${file}.ts`, () => {
      const code = readFileSync(new URL(`./${file}.ts`, import.meta.url), 'utf8')
        .split('\n')
        .filter((line) => !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*'))
        .join('\n');
      expect(code).not.toMatch(FORBIDDEN);
    });
  }
});

describe('HistoryStack (LIFO)', () => {
  it('pops in reverse order and peeks at the top', () => {
    const h = new HistoryStack<S>();
    h.push(A); h.push(B); h.push(C);
    expect(h.size()).toBe(3);
    expect(h.peek()).toBe(C);
    expect(h.pop()).toBe(C);
    expect(h.peek()).toBe(B);
    expect(h.pop()).toBe(B);
    expect(h.pop()).toBe(A);
    expect(h.pop()).toBeUndefined();
    expect(h.peek()).toBeUndefined();
    expect(h.isEmpty()).toBe(true);
  });
  it('drops the oldest entry when full and lists newest first', () => {
    const h = new HistoryStack<number>(3);
    [1, 2, 3, 4].forEach((n) => h.push(n));
    expect(h.size()).toBe(3);
    expect(h.toArrayRecentFirst()).toEqual([4, 3, 2]);
    expect(h.toArrayRecentFirst(2)).toEqual([4, 3]);
  });
});

describe('UpNextQueue (FIFO)', () => {
  it('dequeues in the order songs were added', () => {
    const q = new UpNextQueue<S>();
    expect(q.dequeue()).toBeUndefined();
    q.enqueue(A); q.enqueue(B); q.enqueue(C);
    expect(q.peek()).toBe(A);
    expect(q.dequeue()).toBe(A);
    expect(q.dequeue()).toBe(B);
    expect(q.size()).toBe(1);
    q.enqueue(D);
    expect(ids(q.toArray())).toBe('c,d');
    q.dequeue(); q.dequeue();
    expect(q.isEmpty()).toBe(true);
    q.enqueue(E);
    expect(q.peek()).toBe(E);
  });
  it('removeWhere keeps front and back pointers right', () => {
    const q = new UpNextQueue<S>();
    [A, B, C, D].forEach((s) => q.enqueue(s));
    expect(q.removeWhere((s) => s.id === 'd')).toBe(1);   // the back
    q.enqueue(E);                                         // back pointer must still work
    expect(ids(q.toArray())).toBe('a,b,c,e');
    expect(q.removeWhere((s) => s.id === 'a')).toBe(1);   // the front
    expect(q.peek()).toBe(B);
    expect(q.removeWhere((s) => s.id === 'c')).toBe(1);   // the middle
    expect(ids(q.toArray())).toBe('b,e');
    q.clear();
    expect(q.isEmpty()).toBe(true);
  });
});

describe('Playlist (singly linked) and Fisher-Yates shuffle', () => {
  it('adds and removes at both ends, including on an empty list', () => {
    const p = new Playlist<S>();
    expect(p.removeFirst()).toBeUndefined();
    expect(p.removeLast()).toBeUndefined();
    p.addFirst(A);                 // addFirst on an empty list
    p.addSong(B); p.addSong(C);
    p.addFirst(D);
    expect(ids(p.toArray())).toBe('d,a,b,c');
    expect(p.removeLast()).toBe(C);
    expect(p.removeFirst()).toBe(D);
    expect(ids(p.toArray())).toBe('a,b');
    p.removeLast(); p.removeLast();
    expect(p.size()).toBe(0);
    p.addSong(E);
    expect(ids(p.toArray())).toBe('e');
  });
  it('shuffle keeps every song exactly once and is repeatable with the same random numbers', () => {
    const make = () => { const p = new Playlist<S>(); [A, B, C, D, E].forEach((s) => p.addSong(s)); return p; };
    const p1 = make(); p1.shuffle(seeded(7));
    const p2 = make(); p2.shuffle(seeded(7));
    expect(ids(p1.toArray())).toBe(ids(p2.toArray()));
    expect(p1.toArray().map((s) => s.id).sort().join(',')).toBe('a,b,c,d,e');
    expect(p1.size()).toBe(5);
    p1.addSong(song('z', 'Zed', 100));                // tail pointer still valid after shuffle
    expect(p1.toArray().length).toBe(6);
  });
});

describe('TrackLibrary (sort and search)', () => {
  const build = () => { const l = new TrackLibrary<S>(); [A, B, C, D, E].forEach((s) => l.addSong(s)); return l; };
  it('sorts by duration, shortest first and longest first', () => {
    const l = build();
    l.sortByDuration();
    expect(ids(l.toArray())).toBe('b,e,d,a,c');
    l.sortByDuration(true);
    expect(ids(l.toArray())).toBe('c,a,d,e,b');
    expect(l.sortedBy()).toBe('duration');
  });
  it('is stable for equal durations', () => {
    const l = new TrackLibrary<S>();
    [song('1', 'x', 100), song('2', 'y', 100), song('3', 'z', 50)].forEach((s) => l.addSong(s));
    l.sortByDuration();
    expect(ids(l.toArray())).toBe('3,1,2');
  });
  it('linear search finds an exact title in any order, ignoring case', () => {
    const l = build();
    expect(l.searchByTitle('calm down')).toBe(C);
    expect(l.searchByTitle('Nope')).toBeNull();
  });
  it('binary search finds exact titles once sorted A to Z, and falls back to linear when not sorted', () => {
    const l = build();
    expect(l.searchByTitleSorted('Love Nwantiti')).toBe(D);   // not sorted: must still be right
    l.sortByTitleAlphabetical();
    expect(l.sortedBy()).toBe('title');
    expect(l.toArray().map((s) => s.title).join('|')).toBe('Bandana|Calm Down|Essence|Last Last|Love Nwantiti');
    for (const s of [A, B, C, D, E]) expect(l.searchByTitleSorted(s.title.toUpperCase())).toBe(s);
    expect(l.searchByTitleSorted('Zzz')).toBeNull();
    expect(l.searchByTitleSorted('')).toBeNull();
  });
  it('adding a song forgets the sort order so binary search is never trusted on a broken list', () => {
    const l = build();
    l.sortByTitleAlphabetical();
    l.addSong(song('z', 'Aardvark', 10));
    expect(l.sortedBy()).toBe('none');
    expect(l.searchByTitleSorted('Aardvark')?.id).toBe('z');
  });
  it('search puts the exact title first, then everything containing the text (title or artist)', () => {
    const l = build();
    expect(ids(l.search('last last'))).toBe('b');
    expect(ids(l.search('AN'))).toBe('d,e');                 // Love Nwantiti, Bandana, in list order
    expect(ids(l.search('burna'))).toBe('b');                // matches on artist
    expect(l.search('   ')).toEqual([]);
    l.addSong(song('x', 'Calm', 10));
    l.sortByTitleAlphabetical();
    expect(l.search('calm')[0].id).toBe('x');                // exact title first, even though 'Calm Down' sorts later
    expect(ids(l.search('calm'))).toBe('x,c');
  });
  it('add and remove at both ends', () => {
    const l = new TrackLibrary<S>();
    expect(l.removeFirst()).toBeUndefined();
    l.addSong(A); l.addSong(B); l.addFirst(C);
    expect(ids(l.toArray())).toBe('c,a,b');
    expect(l.removeLast()).toBe(B);
    expect(l.removeFirst()).toBe(C);
    expect(l.getAt(0)).toBe(A);
    expect(l.getAt(5)).toBeUndefined();
  });
});

describe('supporting algorithms', () => {
  it('isPalindrome', () => {
    expect(isPalindrome('Racecar')).toBe(true);
    expect(isPalindrome('A man, a plan, a canal: Panama')).toBe(true);
    expect(isPalindrome('Spotify')).toBe(false);
  });
  it('capitalizeTitle', () => {
    expect(capitalizeTitle('love nwantiti by ckay')).toBe('Love Nwantiti By Ckay');
    expect(capitalizeTitle('LAST  LAST')).toBe('Last  Last');
    expect(capitalizeTitle('')).toBe('');
  });
  it('sumDurations and findLongestSong', () => {
    expect(sumDurations([A, B, C])).toBe(595);
    expect(sumDurations([])).toBe(0);
    expect(findLongestSong([A, B, C])).toBe(C);
    expect(findLongestSong([])).toBeNull();
  });
});

describe('PlaybackEngine: what the player buttons do', () => {
  const fresh = (random?: () => number) => { const e = new PlaybackEngine<S>(random); e.playFrom(A, [A, B, C, D, E]); return e; };
  const now = (e: PlaybackEngine<S>) => e.snapshot().current?.id;
  const hist = (e: PlaybackEngine<S>) => ids(e.snapshot().history);

  it('play logs the song; next and previous move through the list one step at a time', () => {
    const e = fresh();
    expect(now(e)).toBe('a');
    expect(e.next().track?.id).toBe('b');
    expect(e.next().track?.id).toBe('c');
    expect(e.previous().track?.id).toBe('b');
    expect(now(e)).toBe('b');
    expect(hist(e)).toBe('b,c,b,a');                // newest first, every play is logged
  });
  it('stops at the end of the playlist (no wrap around) and at the start', () => {
    const e = fresh();
    expect(e.previous()).toMatchObject({ reason: 'start-of-playlist', changed: false });
    expect(now(e)).toBe('a');
    e.next(); e.next(); e.next(); e.next();
    expect(now(e)).toBe('e');
    expect(e.next()).toMatchObject({ reason: 'end-of-playlist', changed: false });
    expect(now(e)).toBe('e');
    expect(e.snapshot().hasNext).toBe(false);
  });
  it('previous restarts the song when it has played more than 3 seconds', () => {
    const e = fresh();
    e.next();
    expect(e.previous(5)).toMatchObject({ reason: 'restarted', changed: false });
    expect(now(e)).toBe('b');
    expect(e.previous(2).track?.id).toBe('a');
  });
  it('queue intercept: queued songs play first, in order, then the playlist carries on from where it was', () => {
    const e = fresh();
    e.next();                                        // playing b
    e.enqueue(D); e.enqueue(E);
    expect(e.snapshot().upNext.length).toBe(2);
    expect(e.next()).toMatchObject({ reason: 'played', fromQueue: true });
    expect(now(e)).toBe('d');
    expect(e.next().track?.id).toBe('e');
    expect(e.snapshot().upNext.length).toBe(0);
    expect(e.next().track?.id).toBe('c');            // cursor was still on b, so the next playlist song is c
    expect(hist(e)).toBe('c,e,d,b,a');
  });
  it('previous undoes a queued song with the history stack', () => {
    const e = fresh();
    e.next();                                        // b
    e.enqueue(D); e.enqueue(E);
    e.next(); e.next();                              // d then e, both from the queue
    expect(now(e)).toBe('e');
    expect(e.previous().track?.id).toBe('d');        // back to the other queued song
    expect(e.snapshot().fromQueue).toBe(true);
    expect(e.previous().track?.id).toBe('b');        // then to the song heard before the queue
    expect(e.snapshot().fromQueue).toBe(false);
    expect(e.previous().track?.id).toBe('a');        // and from there the normal list order
    expect(hist(e)).toBe('a,b,a');                   // the two queued songs were popped off the history
  });
  it('a queued song never moves the playlist cursor, so Next after the queue is not skipped or repeated', () => {
    const e = fresh();
    e.enqueue(C);
    e.next();                                        // c from the queue while the cursor is on a
    expect(e.next().track?.id).toBe('b');            // playlist continues with the song after a
  });
  it('playing a song that is not in the list adds it to the end; unknown start with no list works too', () => {
    const e = new PlaybackEngine<S>();
    expect(e.next()).toMatchObject({ reason: 'empty' });
    expect(e.previous()).toMatchObject({ reason: 'empty' });
    expect(e.play()).toMatchObject({ reason: 'empty' });
    e.playFrom(A);
    e.playFrom(B);
    expect(ids(e.snapshot().playlist)).toBe('a,b');
    expect(e.previous().track?.id).toBe('a');
  });
  it('adoptContext swaps the list around the playing song without restarting it or touching the history', () => {
    const e = fresh();
    e.next();                                                    // playing b
    const before = hist(e);
    e.adoptContext(B, [E, D, B, A, C]);
    expect(now(e)).toBe('b');
    expect(hist(e)).toBe(before);
    expect(ids(e.snapshot().playlist)).toBe('e,d,b,a,c');
    expect(e.snapshot().cursorIndex).toBe(2);
    expect(e.next().track?.id).toBe('a');
  });
  it('removing from the queue and clearing it', () => {
    const e = fresh();
    e.enqueue(B); e.enqueue(C); e.enqueue(D);
    e.removeFromUpNext('c');
    expect(ids(e.snapshot().upNext)).toBe('b,d');
    e.clearUpNext();
    expect(e.snapshot().upNext.length).toBe(0);
    expect(e.next().track?.id).toBe('b');            // plain playlist order again
  });

  describe('shuffle', () => {
    it('keeps the song that is playing first and plays every other song exactly once', () => {
      const e = fresh(seeded(3));
      e.next();                                      // playing b
      e.setShuffle(true);
      const snap = e.snapshot();
      expect(snap.current?.id).toBe('b');
      expect(snap.playlist[0].id).toBe('b');
      expect(snap.cursorIndex).toBe(0);
      expect(snap.playlist.map((s) => s.id).sort().join(',')).toBe('a,b,c,d,e');
      const played: string[] = [];
      let r = e.next();
      while (r.reason === 'played') { played.push(r.track!.id); r = e.next(); }
      expect(played.length).toBe(4);
      expect(new Set(played).size).toBe(4);
      expect(played.includes('b')).toBe(false);
      expect(r.reason).toBe('end-of-playlist');
    });
    it('turning it off restores the original order and the same song keeps playing', () => {
      const e = fresh(seeded(11));
      e.next(); e.next();                            // playing c
      e.setShuffle(true);
      e.next();
      const playing = now(e);
      e.setShuffle(false);
      const snap = e.snapshot();
      expect(ids(snap.playlist)).toBe('a,b,c,d,e');
      expect(snap.current?.id).toBe(playing);
      expect(snap.playlist[snap.cursorIndex].id).toBe(playing);
      expect(e.isShuffled()).toBe(false);
    });
    it('a new list played while shuffle is on is shuffled too, and starts on the chosen song', () => {
      const e = new PlaybackEngine<S>(seeded(5));
      e.setShuffle(true);                            // nothing loaded yet
      e.playFrom(C, [A, B, C, D, E]);
      const snap = e.snapshot();
      expect(snap.current?.id).toBe('c');
      expect(snap.playlist[0].id).toBe('c');
      expect(snap.playlist.length).toBe(5);
      e.setShuffle(false);
      expect(ids(e.snapshot().playlist)).toBe('a,b,c,d,e');
    });
  });
});
