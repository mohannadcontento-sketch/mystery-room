// Shared types between frontend and backend.

export type GameMode = "question_for_all" | "question_for_random" | "autocomplete_battle";

export type RoomStatus =
  | "waiting"
  | "questioning"
  | "answering"
  | "thinking"
  | "revealing"
  | "chatting"
  | "finished";

export interface Profile {
  id: string;
  username: string;
  avatar: string;
}

export interface Room {
  id: string;
  roomCode: string;
  gameMode: GameMode;
  status: RoomStatus;
  creatorId?: string;
  createdAt?: string;
  playersCount?: number;
}

export interface RoomPlayer {
  id: string;
  anonymousName: string;
  joinedAt: string;
  isYou?: boolean;
  isCreator?: boolean;
}

export interface Question {
  id: string;
  questionText: string;
  round: number;
  mode: GameMode;
  createdAt: string;
  targetPlayerId?: string | null;
}

export interface Answer {
  id: string;
  answerText: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  anonymousUser: string;
  message: string;
  createdAt: string;
  mine?: boolean;
}

// Avatar options — emojis work cross-platform without bundling image assets.
export const AVATAR_OPTIONS = [
  "🎭", "🦊", "🦉", "🐺", "🐱", "🦇", "🐉", "🦂",
  "🐍", "🦄", "👻", "🎃", "🌙", "⭐", "🔮", "🗝️",
  "👁️", "🦅", "🦝", "🐈‍⬛", "🪄", "🍷", "🥀", "💀",
];

export const GAME_MODE_LABELS: Record<GameMode, string> = {
  question_for_all: "سؤال للجميع",
  question_for_random: "سؤال لشخص عشوائي",
  autocomplete_battle: "اتوبيس كومبليت",
};

export const GAME_MODE_DESCRIPTIONS: Record<GameMode, string> = {
  question_for_all:
    "كل لاعب يكتب سؤالاً، يُختار عشوائياً، والجميع يجيب ثم خمّن صاحب الإجابة.",
  question_for_random:
    "النظام يختار لاعباً عشوائياً لك، ترسل له سؤالاً مجهولاً، وتتلقى إجابة مجهولة.",
  autocomplete_battle:
    "أكمل الجملة بأسرع ما يمكن! استخدم الصوت أو الكتابة. الأسرع والأكثر إبداعاً يفوز.",
};

export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  waiting: "في الانتظار",
  questioning: "كتابة الأسئلة",
  answering: "مرحلة الإجابة",
  thinking: "وقت التفكير",
  revealing: "كشف الإجابات",
  chatting: "نقاش مباشر",
  finished: "منتهية",
};
