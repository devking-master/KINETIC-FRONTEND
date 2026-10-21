import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  Heart,
  MessageCircle,
  Play,
  Send,
  Share2,
  UserPlus,
} from "../ui/Icon";
import { ActiveTab, AuthUser, LiveComment, ShortVideo } from "../../types";
import { authApi } from "../../services/authApi";
import { videoApi } from "../../services/videoApi";
import { MediaLoadingState } from "../MediaLoadingState";
import { StateFeedback } from "../ui/StateFeedback";
import { Field } from "../ui/Field";
import { Avatar } from "../ui/Avatar";

interface WatchViewProps {
  video: ShortVideo;
  onBack: () => void;
  onOpenProfile: (username: string) => void;
  onOpenWatch: (video: ShortVideo) => void;
  onNavigate: (tab: ActiveTab) => void;
  currentUser: AuthUser | null;
}

export const WatchView: React.FC<WatchViewProps> = ({
  video,
  onBack,
  onOpenProfile,
  onOpenWatch,
  onNavigate,
  currentUser = null,
}) => {
  const [comments, setComments] = useState<LiveComment[]>([]);
  const [related, setRelated] = useState<ShortVideo[]>([]);
  const [commentText, setCommentText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liked, setLiked] = useState(!!video.isLiked);
  const [saved, setSaved] = useState(!!video.isBookmarked);
  const [likesCount, setLikesCount] = useState(video.likesCount || 0);
  const [isFollowing, setIsFollowing] = useState(false);
  const isKineticVideo = video.source !== 'api' && /^[a-f\d]{24}$/i.test(video.id);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [allVideos, fetchedComments] = await Promise.all([
          videoApi.getAllVideos(),
          videoApi.getComments(video.id),
        ]);
        if (cancelled) return;
        setComments(fetchedComments);
        setRelated(
          allVideos
            .filter(
              (item) =>
                item.id !== video.id &&
                (item.creatorName === video.creatorName ||
                  item.caption
                    .split(" ")
                    .some(
                      (word) =>
                        word.startsWith("#") && video.caption.includes(word),
                    )),
            )
            .slice(0, 6),
        );
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Unable to load this video",
          );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    void videoApi.recordView(video.id).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [video]);

  const requireToken = async () => authApi.getValidToken();
  const handleLike = async () => {
    if (!isKineticVideo) return;
    const token = await requireToken();
    if (!token) {
      setError("Sign in to like videos.");
      return;
    }
    const next = !liked;
    setLiked(next);
    setLikesCount((count) => Math.max(0, count + (next ? 1 : -1)));
    try {
      const result = await videoApi.setLike(video.id, next, token);
      setLiked(result.liked);
      if (typeof result.likesCount === "number")
        setLikesCount(result.likesCount);
    } catch (err) {
      setLiked(!next);
      setLikesCount((count) => Math.max(0, count + (next ? -1 : 1)));
      setError(err instanceof Error ? err.message : "Unable to update like");
    }
  };
  const handleSave = async () => {
    if (!isKineticVideo) return;
    const token = await requireToken();
    if (!token) {
      setError("Sign in to save videos.");
      return;
    }
    const next = !saved;
    setSaved(next);
    try {
      const result = await videoApi.toggleSaveVideo(video.id, token);
      setSaved(result.saved);
    } catch (err) {
      setSaved(!next);
      setError(err instanceof Error ? err.message : "Unable to save video");
    }
  };
  const handleComment = async (event: React.FormEvent) => {
    event.preventDefault();
    const text = commentText.trim();
    const token = await requireToken();
    if (!text || !token) return;
    try {
      const result = await videoApi.addComment(video.id, text, token);
      setComments((items) => [result.comment, ...items]);
      setCommentText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to post comment");
    }
  };

  if (isLoading) return <MediaLoadingState />;
  if (error && !video.videoUrl)
    return (
      <StateFeedback
        state="error"
        title="Video unavailable"
        message={error}
        action={{ label: "Go back", onClick: onBack }}
      />
    );

  return (
    <div className="pb-28 pt-5 animate-in fade-in duration-300">
      <button onClick={onBack} className="inline-flex items-center gap-2 text-xs font-bold text-[var(--muted)] hover:text-[var(--text)] mb-5">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <div className="grid xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <main className="min-w-0">
          <div className="aspect-video max-h-[68vh] rounded-2xl overflow-hidden bg-black border border-[var(--border)] shadow-2xl">
            <video
              src={video.videoUrl}
              poster={video.thumbnailUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          </div>
          <div className="py-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-[var(--text)] font-display">
                  {video.caption}
                </h1>
                <div className="flex items-center gap-2 text-xs text-[var(--subtle)] mt-2">
                  <span>{video.views} views</span>
                  <span>•</span>
                  <span>{Math.round(video.duration)}s</span>
                  <span className="px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent-hover)]">
                    {video.source === "api" ? "Provider" : "Kinetic upload"}
                  </span>
                </div>
              </div>
              <button
                onClick={() =>
                  onOpenProfile(video.creatorHandle.replace(/^@/, ""))
                }
                className="shrink-0"
              >
                <Avatar
                  src={currentUser && ((video.creator && video.creator === currentUser.id) || video.creatorHandle.replace(/^@/, '').toLowerCase() === currentUser.username.toLowerCase()) ? currentUser.avatarUrl : video.creatorAvatar}
                  name={video.creatorName}
                  size={48}
                  className="border-2 border-[var(--accent)]"
                />
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                disabled={!isKineticVideo}
                title={isKineticVideo ? 'Like video' : 'Sample video'}
                onClick={handleLike}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ${liked ? "bg-[var(--like)]/15 text-[var(--like)]" : "bg-[var(--raised)] text-[var(--text)] border border-[var(--border)]"}`}
              >
                <Heart className={`w-4 h-4 ${liked ? "fill-current" : ""}`} />
                {likesCount}
              </button>
              <button
                disabled={!isKineticVideo}
                title={isKineticVideo ? 'Save video' : 'Sample video'}
                onClick={handleSave}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-[var(--raised)] border border-[var(--border)] disabled:cursor-not-allowed disabled:opacity-50 ${saved ? "text-[var(--accent-hover)] border-[var(--accent)]" : "text-[var(--text)]"}`}
              >
                <Bookmark
                  className={`w-4 h-4 ${saved ? "fill-current" : ""}`}
                />
                {saved ? "Saved" : "Save"}
              </button>
              <button
                onClick={() =>
                  navigator.share?.({
                    title: video.caption,
                    url: window.location.href,
                  })
                }
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--raised)] border border-[var(--border)] text-xs font-bold text-[var(--text)]"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
              <button
                disabled={!isKineticVideo}
                title={isKineticVideo ? 'Follow creator' : 'Sample video'}
                onClick={() => {
                  setIsFollowing((value) => !value);
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--raised)] border border-[var(--border)] text-xs font-bold text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                {isFollowing ? "Following" : "Follow"}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {video.caption
                .split(/\s+/)
                .filter((word) => word.startsWith("#"))
                .map((tag) => (
                  <span
                    key={tag}
                    className="text-xs text-[var(--accent-hover)]"
                  >
                    {tag}
                  </span>
                ))}
            </div>
          </div>
          <Comments
            comments={comments}
            text={commentText}
            currentUser={currentUser}
            onText={setCommentText}
            onSubmit={handleComment}
          />
        </main>
        <aside className="xl:sticky xl:top-24 bg-[var(--raised)] border border-[var(--border)] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-[var(--text)]">
              More like this
            </h2>
            <button
              onClick={() => onNavigate("shorts")}
              className="text-[10px] font-bold text-[var(--accent-hover)]"
            >
              Open Shorts
            </button>
          </div>
          {related.length ? (
            <div className="space-y-3">
              {related.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onOpenWatch(item)}
                  className="w-full flex gap-3 text-left group"
                >
                  <div className="relative w-32 aspect-video shrink-0 rounded-xl overflow-hidden bg-[var(--surface)]">
                    <img
                      src={item.thumbnailUrl}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <Play className="absolute inset-0 m-auto w-6 h-6 text-[var(--text)] fill-white opacity-80" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[var(--text)] line-clamp-2">
                      {item.caption}
                    </div>
                    <div className="text-[10px] text-[var(--subtle)] mt-1">
                      {item.creatorName} · {item.views} views
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--subtle)] py-5">
              No related videos yet.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
};

const Comments = ({
  comments,
  text,
  currentUser,
  onText,
  onSubmit,
}: {
  comments: LiveComment[];
  text: string;
  currentUser?: AuthUser | null;
  onText: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) => (
  <section className="border-t border-[var(--border)] pt-5">
    <div className="flex items-center gap-2 mb-4">
      <MessageCircle className="w-4 h-4 text-[var(--accent-hover)]" />
      <h2 className="text-sm font-black text-[var(--text)]">Comments</h2>
      <span className="text-xs text-[var(--subtle)]">{comments.length}</span>
    </div>
    <form onSubmit={onSubmit} className="flex gap-2 mb-5">
      <Field
        value={text}
        onChange={(e) => onText(e.target.value)}
        maxLength={500}
        placeholder="Add a comment..."
        className="flex-1 px-4 py-2.5 text-xs"
      />
      <button
        type="submit"
        title="Post comment"
        className="p-2.5 rounded-full bg-[var(--accent)] text-[var(--text)]"
      >
        <Send className="w-4 h-4" />
      </button>
    </form>
    <div className="max-h-80 overflow-y-auto space-y-4">
      {comments.map((comment) => (
        <div key={comment.id} className="flex gap-3">
          <Avatar
            src={currentUser && comment.userHandle.replace(/^@/, '').toLowerCase() === currentUser.username.toLowerCase() ? currentUser.avatarUrl : comment.userAvatar}
            name={comment.userHandle}
            size={32}
          />
          <div className="min-w-0">
            <div className="text-xs font-bold text-[var(--text)]">
              {comment.userHandle}
            </div>
            <p className="text-xs text-[var(--muted)] mt-1">{comment.text}</p>
            <span className="text-[10px] text-[var(--subtle)]">
              {comment.timeAgo}
            </span>
          </div>
        </div>
      ))}
    </div>
  </section>
);
