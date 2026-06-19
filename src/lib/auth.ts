import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const JWT_SECRET = process.env.JWT_SECRET || "mystery-room-dev-secret-change-me";
const COOKIE_NAME = "mystery_session";
const SESSION_DAYS = 7;

export interface SessionPayload {
  userId: string;
  username: string;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: `${SESSION_DAYS}d` });
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as SessionPayload;
    return decoded;
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = signToken(payload);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * SESSION_DAYS,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  const user = await db.profile.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, avatar: true, createdAt: true },
  });
  return user;
}

/**
 * Anonymous name generator — used to mask a player's identity inside a room.
 * Names follow a "Adjective Noun" pattern and never reuse the same noun
 * inside the same room, so players can be told apart without revealing
 * their real identity.
 */
const ADJECTIVES = [
  "Shadow",
  "Crimson",
  "Velvet",
  "Silent",
  "Mystic",
  "Hidden",
  "Ghostly",
  "Whispering",
  "Secret",
  "Midnight",
  "Forgotten",
  "Lonely",
  "Distant",
  "Vanishing",
  "Phantom",
  "Twilight",
];

const NOUNS = [
  "Fox",
  "Raven",
  "Wolf",
  "Owl",
  "Cat",
  "Moth",
  "Sparrow",
  "Hare",
  "Lynx",
  "Stag",
  "Cobra",
  "Mantis",
  "Heron",
  "Viper",
  "Moth",
  "Wren",
];

export function generateAnonymousName(taken: string[] = []): string {
  const used = new Set(taken);
  for (let i = 0; i < 50; i++) {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const candidate = `${adj} ${noun}`;
    if (!used.has(candidate)) return candidate;
  }
  // fallback
  return `Stranger ${Math.floor(Math.random() * 9999)}`;
}

/** Generate a 6-character room code, uppercase A-Z + 2-9 (no ambiguous chars). */
export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
