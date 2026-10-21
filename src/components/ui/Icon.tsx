import React from 'react';
import {
  ArrowLeft as PhosphorArrowLeft,
  ArrowRight as PhosphorArrowRight,
  ArrowsClockwise as PhosphorArrowsClockwise,
  Bell as PhosphorBell,
  BookmarkSimple as PhosphorBookmarkSimple,
  Books as PhosphorBooks,
  CaretDown as PhosphorCaretDown,
  CaretRight as PhosphorCaretRight,
  CaretUp as PhosphorCaretUp,
  ChartBar as PhosphorChartBar,
  ChatCircle as PhosphorChatCircle,
  Check as PhosphorCheck,
  CheckCircle as PhosphorCheckCircle,
  Clock as PhosphorClock,
  Compass as PhosphorCompass,
  Copy as PhosphorCopy,
  DotsThree as PhosphorDotsThree,
  Envelope as PhosphorEnvelope,
  Eye as PhosphorEye,
  EyeSlash as PhosphorEyeSlash,
  FilmReel as PhosphorFilmReel,
  Flag as PhosphorFlag,
  FunnelSimple as PhosphorFunnelSimple,
  Heart as PhosphorHeart,
  House as PhosphorHouse,
  Image as PhosphorImage,
  LinkSimple as PhosphorLinkSimple,
  List as PhosphorList,
  LockKey as PhosphorLockKey,
  MagnifyingGlass as PhosphorMagnifyingGlass,
  MagnifyingGlassMinus as PhosphorMagnifyingGlassMinus,
  MusicNotes as PhosphorMusicNotes,
  PaperPlaneTilt as PhosphorPaperPlaneTilt,
  PencilSimple as PhosphorPencilSimple,
  Pause as PhosphorPause,
  Play as PhosphorPlay,
  Playlist as PhosphorPlaylist,
  Plus as PhosphorPlus,
  Radio as PhosphorRadio,
  Repeat as PhosphorRepeat,
  ShareFat as PhosphorShareFat,
  SealCheck as PhosphorSealCheck,
  Shuffle as PhosphorShuffle,
  SignIn as PhosphorSignIn,
  SignOut as PhosphorSignOut,
  SkipBack as PhosphorSkipBack,
  SkipForward as PhosphorSkipForward,
  SpeakerHigh as PhosphorSpeakerHigh,
  SpeakerSlash as PhosphorSpeakerSlash,
  Sparkle as PhosphorSparkle,
  SquaresFour as PhosphorSquaresFour,
  Stack as PhosphorStack,
  TrendUp as PhosphorTrendUp,
  UploadSimple as PhosphorUploadSimple,
  User as PhosphorUser,
  UserCheck as PhosphorUserCheck,
  UserPlus as PhosphorUserPlus,
  UsersThree as PhosphorUsersThree,
  VideoCamera as PhosphorVideoCamera,
  VinylRecord as PhosphorVinylRecord,
  Warning as PhosphorWarning,
  WarningCircle as PhosphorWarningCircle,
  X as PhosphorX,
  Waveform as PhosphorWaveform,
  WifiSlash as PhosphorWifiSlash,
  type IconProps as PhosphorIconProps,
} from '@phosphor-icons/react';

type IconComponent = React.ComponentType<PhosphorIconProps>;

const makeIcon = (Source: IconComponent, defaultWeight: PhosphorIconProps['weight'] = 'regular'): IconComponent => {
  const IconView: IconComponent = ({ size, weight, className = '', style, ...props }) => {
    const sizeClass = className.match(/(?:^|\s)(?:w|h)-(\d+(?:\.\d+)?)(?:\s|$)/)?.[1];
    const requestedSize = Number(sizeClass) * 4 || Number(size) || 20;
    const normalizedSize = requestedSize <= 17 ? 16 : requestedSize <= 22 ? 20 : 24;
    const normalizedClassName = className
      .replace(/(?:^|\s)(?:w|h)-(?:\d+(?:\.\d+)?)(?:\s|$)/g, ' ')
      .replace(/(?:^|\s)fill-(?:current|white)(?:\s|$)/g, ' ')
      .trim();
    const normalizedWeight = weight || (className.includes('fill-') ? 'fill' : defaultWeight);

    return (
      <Source
        {...props}
        size={normalizedSize}
        weight={normalizedWeight}
        className={normalizedClassName}
        style={{ ...style, width: normalizedSize, height: normalizedSize }}
      />
    );
  };
  IconView.displayName = 'KineticIcon';
  return IconView;
};

export const Icon = {
  home: makeIcon(PhosphorHouse),
  discover: makeIcon(PhosphorCompass),
  music: makeIcon(PhosphorMusicNotes),
  shorts: makeIcon(PhosphorFilmReel),
  upload: makeIcon(PhosphorVideoCamera),
  library: makeIcon(PhosphorBooks),
  playlist: makeIcon(PhosphorPlaylist),
  record: makeIcon(PhosphorVinylRecord),
  radio: makeIcon(PhosphorWaveform),
  search: makeIcon(PhosphorMagnifyingGlass),
  searchX: makeIcon(PhosphorMagnifyingGlassMinus),
  verified: makeIcon(PhosphorSealCheck, 'fill'),
  plus: makeIcon(PhosphorPlus),
  like: makeIcon(PhosphorHeart),
  comment: makeIcon(PhosphorChatCircle),
  share: makeIcon(PhosphorShareFat),
  bookmark: makeIcon(PhosphorBookmarkSimple),
  volume: makeIcon(PhosphorSpeakerHigh),
  muted: makeIcon(PhosphorSpeakerSlash),
  flag: makeIcon(PhosphorFlag),
  more: makeIcon(PhosphorDotsThree, 'bold'),
  user: makeIcon(PhosphorUser),
  follow: makeIcon(PhosphorUserPlus),
  followed: makeIcon(PhosphorUserCheck),
  users: makeIcon(PhosphorUsersThree),
  logout: makeIcon(PhosphorSignOut),
  eye: makeIcon(PhosphorEye),
  eyeOff: makeIcon(PhosphorEyeSlash),
  mail: makeIcon(PhosphorEnvelope),
  lock: makeIcon(PhosphorLockKey),
  chevronDown: makeIcon(PhosphorCaretDown),
  chevronUp: makeIcon(PhosphorCaretUp),
  chevronRight: makeIcon(PhosphorCaretRight),
  arrowRight: makeIcon(PhosphorArrowRight),
  arrowLeft: makeIcon(PhosphorArrowLeft),
  check: makeIcon(PhosphorCheck),
  checkCircle: makeIcon(PhosphorCheckCircle),
  alert: makeIcon(PhosphorWarningCircle),
  wifiOff: makeIcon(PhosphorWifiSlash),
  trending: makeIcon(PhosphorTrendUp),
  shuffle: makeIcon(PhosphorShuffle),
  repeat: makeIcon(PhosphorRepeat),
  previous: makeIcon(PhosphorSkipBack),
  next: makeIcon(PhosphorSkipForward),
  play: makeIcon(PhosphorPlay, 'fill'),
  pause: makeIcon(PhosphorPause, 'fill'),
  bell: makeIcon(PhosphorBell),
  image: makeIcon(PhosphorImage),
  edit: makeIcon(PhosphorPencilSimple),
  copy: makeIcon(PhosphorCopy),
  link: makeIcon(PhosphorLinkSimple),
  clock: makeIcon(PhosphorClock),
  send: makeIcon(PhosphorPaperPlaneTilt),
  menu: makeIcon(PhosphorList),
  filter: makeIcon(PhosphorFunnelSimple),
  dashboard: makeIcon(PhosphorSquaresFour),
  chart: makeIcon(PhosphorChartBar),
  layers: makeIcon(PhosphorStack),
  refresh: makeIcon(PhosphorArrowsClockwise),
  warning: makeIcon(PhosphorWarning),
  camera: makeIcon(PhosphorVideoCamera),
  disc: makeIcon(PhosphorVinylRecord),
  radioMark: makeIcon(PhosphorRadio),
  x: makeIcon(PhosphorX),
  login: makeIcon(PhosphorSignIn),
};

export const Home = Icon.home;
export const Compass = Icon.discover;
export const Music2 = Icon.music;
export const Music = Icon.music;
export const Film = Icon.shorts;
export const FilmReel = Icon.shorts;
export const Video = Icon.shorts;
export const VideoCamera = Icon.upload;
export const Library = Icon.library;
export const ListMusic = Icon.playlist;
export const Disc = Icon.disc;
export const Disc3 = Icon.disc;
export const Radio = Icon.radio;
export const Search = Icon.search;
export const SearchX = Icon.searchX;
export const Upload = Icon.upload;
export const UploadCloud = Icon.upload;
export const Plus = Icon.plus;
export const Heart = Icon.like;
export const MessageCircle = Icon.comment;
export const Share2 = Icon.share;
export const SealCheck = Icon.verified;
export const Bookmark = Icon.bookmark;
export const Volume2 = Icon.volume;
export const VolumeX = Icon.muted;
export const Flag = Icon.flag;
export const MoreHorizontal = Icon.more;
export const User = Icon.user;
export const UserIcon = Icon.user;
export const UserRound = Icon.user;
export const UserPlus = Icon.follow;
export const UserCheck = Icon.followed;
export const UserRoundCheck = Icon.followed;
export const Users = Icon.users;
export const LogIn = Icon.login;
export const LogOut = Icon.logout;
export const Eye = Icon.eye;
export const EyeOff = Icon.eyeOff;
export const Mail = Icon.mail;
export const LockKeyhole = Icon.lock;
export const X = Icon.x;
export const ChevronDown = Icon.chevronDown;
export const ChevronUp = Icon.chevronUp;
export const ChevronRight = Icon.chevronRight;
export const ArrowRight = Icon.arrowRight;
export const ArrowLeft = Icon.arrowLeft;
export const Check = Icon.check;
export const CheckCircle2 = Icon.checkCircle;
export const AlertCircle = Icon.alert;
export const AlertTriangle = Icon.warning;
export const WifiOff = Icon.wifiOff;
export const TrendingUp = Icon.trending;
export const Shuffle = Icon.shuffle;
export const Repeat = Icon.repeat;
export const SkipBack = Icon.previous;
export const SkipForward = Icon.next;
export const Play = Icon.play;
export const Pause = Icon.pause;
export const Bell = Icon.bell;
export const Image = Icon.image;
export const ImagePlus = Icon.image;
export const Edit3 = Icon.edit;
export const Copy = Icon.copy;
export const Link = Icon.link;
export const Clock = Icon.clock;
export const Send = Icon.send;
export const Menu = Icon.menu;
export const Filter = Icon.filter;
export const LayoutDashboard = Icon.dashboard;
export const BarChart3 = Icon.chart;
export const Layers = Icon.layers;
export const RefreshCw = Icon.refresh;
export const Loader2 = Icon.refresh;
export const FileAudio = Icon.radio;
