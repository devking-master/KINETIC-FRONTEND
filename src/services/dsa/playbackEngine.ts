import { HistoryStack } from './historyStack';
import { UpNextQueue } from './upNextQueue';
import { Playlist } from './playlist';

/**
 * PlaybackEngine: the decision making of the music player, with no audio and no browser in it.
 * (The audio side lives in html5Player.ts and only does what this engine says.)
 *
 * Structures and what they are for:
 *  - doubly linked list : the playlist being played. `cursor` is the current node, so
 *                         next and previous are O(1) pointer moves.
 *  - UpNextQueue (FIFO) : songs the listener added. They play before the playlist carries on.
 *  - HistoryStack (LIFO): every song that started playing. Used to go back to what was really heard.
 *
 * Rules (from the Spotify Lite algorithm):
 *  - play        : start the song at the cursor and push it on the history.
 *  - next        : if the up-next queue has songs, dequeue the front one and play it ("queue intercept"),
 *                  the playlist cursor stays where it was. Otherwise move to cursor.next.
 *                  At the last song there is nothing to skip to: "End of playlist reached".
 *  - previous    : more than 3 seconds in, restart the song. Otherwise move to cursor.prev.
 *                  A song that came from the queue is undone with the history stack (pop), which
 *                  returns to the song that was playing before it. At the first song:
 *                  "Beginning of playlist reached".
 *  - shuffle     : Fisher-Yates over the list; the song playing now stays first. Turning it off
 *                  restores the original order and keeps the same song playing.
 */
class DoublyNode<T> {
  song: T;
  next: DoublyNode<T> | null = null;
  prev: DoublyNode<T> | null = null;

  constructor(song: T) {
    this.song = song;
  }
}

interface HistoryEntry<T> {
  song: T;
  fromQueue: boolean;
}

export type PlaybackReason = 'played' | 'restarted' | 'end-of-playlist' | 'start-of-playlist' | 'empty';

export interface PlaybackResult<T> {
  track: T | null;
  reason: PlaybackReason;
  // true when the caller must load and start `track` (a different song than before)
  changed: boolean;
  fromQueue: boolean;
}

export interface EngineSnapshot<T> {
  current: T | null;
  fromQueue: boolean;
  playlist: T[];
  cursorIndex: number;
  upNext: T[];
  upcoming: T[];
  history: T[];
  hasNext: boolean;
  canGoBack: boolean;
  shuffled: boolean;
}

export const RESTART_AFTER_SECONDS = 3;

export class PlaybackEngine<T extends { id: string }> {
  private head: DoublyNode<T> | null = null;
  private tail: DoublyNode<T> | null = null;
  private cursor: DoublyNode<T> | null = null;
  private byId: Map<string, DoublyNode<T>> = new Map();

  private nowPlaying: T | null = null;
  private nowFromQueue = false;

  private shuffleOn = false;
  private originalOrder: DoublyNode<T>[] | null = null;

  readonly history = new HistoryStack<HistoryEntry<T>>();
  readonly upNext = new UpNextQueue<T>();

  private readonly random: () => number;

  constructor(random: () => number = Math.random) {
    this.random = random;
  }

  // ---------------------------------------------------------------- loading

  // loadPlaylist(playlist): O(n). Turns the singly linked playlist into the doubly linked list, cursor at the head.
  loadPlaylist(playlist: Playlist<T>): void {
    this.rebuild(playlist.toArray());
    this.cursor = this.head;
  }

  // adoptContext(track, context): the listener is on `track` and the page they are looking at has this list.
  // Rebuilds the list around `track` WITHOUT starting a song or touching the history.
  adoptContext(track: T, context: T[]): void {
    const playlist = new Playlist<T>();
    for (let i = 0; i < context.length; i++) {
      playlist.addSong(context[i]);
    }
    this.loadPlaylist(playlist);

    let node = this.byId.get(track.id);
    if (node === undefined) {
      node = this.appendNode(track);
    }
    this.cursor = node;

    if (this.shuffleOn) {
      this.applyShuffle(node);
    }
  }

  // playFrom(track, context): the listener pressed play on `track`, optionally from a list (the page they were on).
  playFrom(track: T, context?: T[]): PlaybackResult<T> {
    if (context && context.length > 0) {
      this.adoptContext(track, context);
    } else {
      let existing = this.byId.get(track.id);
      if (existing === undefined) {
        existing = this.appendNode(track);
      }
      this.cursor = existing;
    }
    return this.startSong((this.cursor as DoublyNode<T>).song, false);
  }

  // play(): O(1). Starts the song at the cursor and logs it.
  play(): PlaybackResult<T> {
    if (this.cursor === null) {
      return { track: null, reason: 'empty', changed: false, fromQueue: false };
    }
    return this.startSong(this.cursor.song, false);
  }

  // ---------------------------------------------------------------- moving

  // next(): O(1)
  next(): PlaybackResult<T> {
    if (!this.upNext.isEmpty()) {
      const queued = this.upNext.dequeue() as T;
      return this.startSong(queued, true); // queue intercept: cursor does not move
    }
    if (this.cursor === null) {
      return { track: this.nowPlaying, reason: 'empty', changed: false, fromQueue: this.nowFromQueue };
    }
    if (this.cursor.next === null) {
      return { track: this.nowPlaying, reason: 'end-of-playlist', changed: false, fromQueue: this.nowFromQueue };
    }
    this.cursor = this.cursor.next;
    return this.startSong(this.cursor.song, false);
  }

  // previous(elapsedSeconds): O(1)
  previous(elapsedSeconds: number = 0): PlaybackResult<T> {
    if (this.nowPlaying === null) {
      return { track: null, reason: 'empty', changed: false, fromQueue: false };
    }

    if (elapsedSeconds > RESTART_AFTER_SECONDS) {
      return { track: this.nowPlaying, reason: 'restarted', changed: false, fromQueue: this.nowFromQueue };
    }

    // The song now playing came from the queue: undo it with the history stack.
    if (this.nowFromQueue) {
      this.history.pop();
      const earlier = this.history.peek();
      if (earlier !== undefined) {
        this.nowPlaying = earlier.song;
        this.nowFromQueue = earlier.fromQueue;
        return { track: earlier.song, reason: 'played', changed: true, fromQueue: earlier.fromQueue };
      }
      return { track: this.nowPlaying, reason: 'restarted', changed: false, fromQueue: this.nowFromQueue };
    }

    if (this.cursor !== null && this.cursor.prev !== null) {
      this.cursor = this.cursor.prev;
      return this.startSong(this.cursor.song, false);
    }

    return { track: this.nowPlaying, reason: 'start-of-playlist', changed: false, fromQueue: false };
  }

  // ---------------------------------------------------------------- up next queue

  // enqueue(track): O(1)
  enqueue(track: T): void {
    this.upNext.enqueue(track);
  }

  // removeFromUpNext(id): O(n)
  removeFromUpNext(id: string): void {
    this.upNext.removeWhere((song) => song.id === id);
  }

  // clearUpNext(): O(1)
  clearUpNext(): void {
    this.upNext.clear();
  }

  // ---------------------------------------------------------------- shuffle

  isShuffled(): boolean {
    return this.shuffleOn;
  }

  // setShuffle(on): O(n)
  setShuffle(on: boolean): void {
    if (on === this.shuffleOn) return;
    this.shuffleOn = on;

    if (on) {
      const keep = this.cursor !== null ? this.cursor : this.head;
      if (keep !== null) this.applyShuffle(keep);
    } else if (this.originalOrder !== null) {
      this.relink(this.originalOrder);
      this.originalOrder = null;
    }
  }

  // ---------------------------------------------------------------- reading state

  snapshot(upcomingLimit: number = 50, historyLimit: number = 30): EngineSnapshot<T> {
    const playlist: T[] = [];
    let cursorIndex = -1;
    let count = 0;
    let node = this.head;
    while (node !== null) {
      if (node === this.cursor) cursorIndex = count;
      playlist[count] = node.song;
      count++;
      node = node.next;
    }

    const upcoming: T[] = [];
    let written = 0;
    let after = this.cursor !== null ? this.cursor.next : null;
    while (after !== null && written < upcomingLimit) {
      upcoming[written] = after.song;
      written++;
      after = after.next;
    }

    const entries = this.history.toArrayRecentFirst(historyLimit);
    const history: T[] = [];
    for (let i = 0; i < entries.length; i++) {
      history[i] = entries[i].song;
    }

    const hasNext = !this.upNext.isEmpty() || (this.cursor !== null && this.cursor.next !== null);
    const canGoBack = this.nowFromQueue
      ? this.history.size() > 1
      : this.cursor !== null && this.cursor.prev !== null;

    return {
      current: this.nowPlaying,
      fromQueue: this.nowFromQueue,
      playlist,
      cursorIndex,
      upNext: this.upNext.toArray(),
      upcoming,
      history,
      hasNext,
      canGoBack,
      shuffled: this.shuffleOn,
    };
  }

  // ---------------------------------------------------------------- internals

  private startSong(song: T, fromQueue: boolean): PlaybackResult<T> {
    this.nowPlaying = song;
    this.nowFromQueue = fromQueue;
    this.history.push({ song, fromQueue });
    return { track: song, reason: 'played', changed: true, fromQueue };
  }

  private rebuild(songs: T[]): void {
    this.head = null;
    this.tail = null;
    this.cursor = null;
    this.byId = new Map();
    this.originalOrder = null;

    for (let i = 0; i < songs.length; i++) {
      const node = new DoublyNode(songs[i]);
      if (!this.byId.has(songs[i].id)) {
        this.byId.set(songs[i].id, node);
      }
      if (this.tail === null) {
        this.head = node;
        this.tail = node;
      } else {
        this.tail.next = node;
        node.prev = this.tail;
        this.tail = node;
      }
    }
  }

  private appendNode(song: T): DoublyNode<T> {
    const node = new DoublyNode(song);
    this.byId.set(song.id, node);
    if (this.tail === null) {
      this.head = node;
      this.tail = node;
    } else {
      this.tail.next = node;
      node.prev = this.tail;
      this.tail = node;
    }
    if (this.originalOrder !== null) {
      this.originalOrder[this.originalOrder.length] = node;
    }
    return node;
  }

  private collectNodes(): DoublyNode<T>[] {
    const nodes: DoublyNode<T>[] = [];
    let written = 0;
    let node = this.head;
    while (node !== null) {
      nodes[written] = node;
      written++;
      node = node.next;
    }
    return nodes;
  }

  private relink(nodes: DoublyNode<T>[]): void {
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].prev = i > 0 ? nodes[i - 1] : null;
      nodes[i].next = i < nodes.length - 1 ? nodes[i + 1] : null;
    }
    this.head = nodes.length > 0 ? nodes[0] : null;
    this.tail = nodes.length > 0 ? nodes[nodes.length - 1] : null;
  }

  // Fisher-Yates over all nodes, then the node that is playing moves to the front.
  private applyShuffle(keep: DoublyNode<T>): void {
    const nodes = this.collectNodes();
    if (nodes.length === 0) return;

    if (this.originalOrder === null) {
      const copy: DoublyNode<T>[] = [];
      for (let i = 0; i < nodes.length; i++) {
        copy[i] = nodes[i];
      }
      this.originalOrder = copy;
    }

    for (let i = nodes.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      const swap = nodes[i];
      nodes[i] = nodes[j];
      nodes[j] = swap;
    }

    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i] === keep) {
        const front = nodes[0];
        nodes[0] = nodes[i];
        nodes[i] = front;
        break;
      }
    }

    this.relink(nodes);
    this.cursor = keep;
  }
}
