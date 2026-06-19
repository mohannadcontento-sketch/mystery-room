// Shared types between frontend and backend.

export type GameMode = "question_for_all" | "question_for_random";

export type RoomStatus =
  | "waiting"
  | "answering"
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
};

export const GAME_MODE_DESCRIPTIONS: Record<GameMode, string> = {
  question_for_all:
    "أي لاعب يستطيع إنشاء سؤال، والجميع يكتب إجابات مجهولة، ثم تناقشون لمدة 5 دقائق.",
  question_for_random:
    "النظام يختار لاعباً عشوائياً لك، ترسل له سؤالاً مجهولاً، وتتلقى إجابة مجهولة.",
};

export const ROOM_STATUS_LABELS: Record<RoomStatus, string> = {
  waiting: "في الانتظار",
  answering: "مرحلة الإجابة",
  revealing: "كشف الإجابات",
  chatting: "نقاش مباشر",
  finished: "منتهية",
};
