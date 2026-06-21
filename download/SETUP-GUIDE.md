# Mystery Room — دليل الإعداد الكامل

لعبة اجتماعية تفاعلية بغرف لعب جماعية تعتمد على الأسئلة والإجابات المجهولة.

## المكدّس التقني (Tech Stack)

| الطبقة | التقنية |
|--------|---------|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Animations | Framer Motion |
| Backend | Next.js API Routes (Route Handlers) |
| Database | Prisma ORM + SQLite (dev) — قابل للاستبدال بـ Supabase |
| Auth | JWT + bcrypt (custom) — قابل للاستبدال بـ Supabase Auth |
| Realtime | HTTP Polling (1-2s) — قابل للاستبدال بـ Supabase Realtime |

---

## 1. تشغيل المشروع محلياً (بدون Supabase)

المشروع يعمل خارج الصندوق بقاعدة بيانات SQLite محلية ومصادقة JWT.

### المتطلبات
- Node.js 18+ أو Bun
- npm / bun

### الخطوات

```bash
# 1. تثبيت الاعتماديات
bun install

# 2. إعداد متغيرات البيئة
cp .env.example .env
# عدّل JWT_SECRET بقيمة عشوائية قوية

# 3. إنشاء قاعدة البيانات
bun run db:push

# 4. تشغيل المشروع
bun run dev
# افتح http://localhost:3000
```

### ملف `.env` المطلوب

```env
# قاعدة البيانات (SQLite افتراضياً)
DATABASE_URL=file:./db/custom.db

# مفتاح توقيع JWT (غيّره بقيمة قوية في الإنتاج)
JWT_SECRET=your-super-secret-key-change-me

# (اختياري) رابط خدمة Realtime خارجية
REALTIME_SERVICE_URL=http://localhost:3003
NEXT_PUBLIC_REALTIME_URL=
```

---

## 2. الانتقال إلى Supabase (الإنتاج)

المشروع مصمم ليكون متوافقاً 100% مع schema المطلوب في Supabase. اتبع هذه الخطوات:

### الخطوة 1: إنشاء مشروع Supabase

1. اذهب إلى https://supabase.com وأنشئ حساباً.
2. أنشئ مشروعاً جديداً (New Project).
3. اختر region قريب من مستخدميك.
4. انتظر حتى يصبح المشروع جاهزاً (1-2 دقيقة).

### الخطوة 2: إنشاء الجداول

افتح SQL Editor في Supabase والصق هذا الكود:

```sql
-- ========================================
-- Mystery Room Schema
-- ========================================

-- profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  avatar TEXT NOT NULL,
  password_hash TEXT, -- يستخدم فقط في وضع JWT المحلي
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- rooms table
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code TEXT UNIQUE NOT NULL,
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  game_mode TEXT NOT NULL DEFAULT 'question_for_all',
  status TEXT NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- room_players table
CREATE TABLE room_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  anonymous_name TEXT NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- questions table
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id UUID, -- nullable، يستخدم في وضع question_for_random
  question_text TEXT NOT NULL,
  mode TEXT NOT NULL,
  round INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- answers table
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question_id, user_id) -- منع الإجابة مرتين
);

-- messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  anonymous_user TEXT NOT NULL, -- الاسم المجهول فقط، وليس user_id
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_rooms_room_code ON rooms(room_code);
CREATE INDEX idx_room_players_room_id ON room_players(room_id);
CREATE INDEX idx_questions_room_id ON questions(room_id);
CREATE INDEX idx_answers_question_id ON answers(question_id);
CREATE INDEX idx_messages_room_id ON messages(room_id);
```

### الخطوة 3: تفعيل Row Level Security (RLS)

**هذا هو الأهم** — يحمي هوية اللاعبين ويمنع تسرّب البيانات:

```sql
-- ========================================
-- Row Level Security Policies
-- ========================================

-- تفعيل RLS على كل الجداول
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- profiles: المستخدم يرى فقط ملفه الشخصي
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- rooms: الجميع يرى الغرف المفتوحة، أي مستخدم ينشئ غرفة
CREATE POLICY "rooms_select_all" ON rooms
  FOR SELECT USING (true);
CREATE POLICY "rooms_insert_auth" ON rooms
  FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "rooms_update_creator" ON rooms
  FOR UPDATE USING (auth.uid() = creator_id);

-- room_players: المستخدم يرى لاعبي الغرف التي ينتمي إليها فقط
-- ومسموح له برؤية anonymous_name فقط (وليس user_id الحقيقي)
CREATE POLICY "room_players_select_member" ON room_players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM room_players rp
      WHERE rp.room_id = room_players.room_id
      AND rp.user_id = auth.uid()
    )
  );
CREATE POLICY "room_players_insert_self" ON room_players
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "room_players_delete_self" ON room_players
  FOR DELETE USING (auth.uid() = user_id);

-- questions: المستخدم يرى أسئلة الغرف التي ينتمي إليها
-- لكن sender_id لا يُكشف (نختاره في SELECT)
CREATE POLICY "questions_select_member" ON questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM room_players rp
      WHERE rp.room_id = questions.room_id
      AND rp.user_id = auth.uid()
    )
  );
CREATE POLICY "questions_insert_member" ON questions
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM room_players rp
      WHERE rp.room_id = questions.room_id
      AND rp.user_id = auth.uid()
    )
  );

-- answers: المستخدم يرى إجابات الأسئلة في غرفه فقط
-- user_id لا يُكشف في SELECT
CREATE POLICY "answers_select_member" ON answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM room_players rp
      JOIN questions q ON q.id = answers.question_id
      WHERE rp.room_id = q.room_id
      AND rp.user_id = auth.uid()
    )
  );
CREATE POLICY "answers_insert_self" ON answers
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM room_players rp
      JOIN questions q ON q.id = answers.question_id
      WHERE rp.room_id = q.room_id
      AND rp.user_id = auth.uid()
    )
  );

-- messages: المستخدم يرى رسائل الغرف التي ينتمي إليها
-- anonymous_user فقط، وليس user_id
CREATE POLICY "messages_select_member" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM room_players rp
      WHERE rp.room_id = messages.room_id
      AND rp.user_id = auth.uid()
    )
  );
CREATE POLICY "messages_insert_member" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM room_players rp
      WHERE rp.room_id = messages.room_id
      AND rp.user_id = auth.uid()
    )
  );
```

### الخطوة 4: إعداد Supabase Auth

1. في Supabase Dashboard → Authentication → Providers
2. فعّل Email provider
3. (اختياري) فعّل Google / GitHub OAuth
4. اضبط Redirect URLs على `http://localhost:3000/api/auth/callback`

### الخطوة 5: تفعيل Realtime

1. في Supabase Dashboard → Database → Replication
2. فعّل Realtime على الجداول التالية:
   - `rooms`
   - `room_players`
   - `questions`
   - `answers`
   - `messages`

### الخطوة 6: تحديث متغيرات البيئة

أنشئ ملف `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY

# app
JWT_SECRET=your-jwt-secret  # غير مطلوب إذا استخدمت Supabase Auth فقط
```

### الخطوة 7: استبدال Prisma بـ Supabase Client

أنشئ `src/lib/supabase.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

ثم استبدل استدعاءات `db.profile.findUnique(...)` بـ `supabase.from('profiles').select().eq(...)`.

> **ملاحظة**: الـ schema في `prisma/schema.prisma` مطابق تماماً لـ schema في Supabase، فقط الأسماء محوّلة من `camelCase` إلى `snake_case`. يمكنك استخدام الـ API routes الموجودة كما هي، فقط استبدل طبقة الـ DB.

---

## 3. المميزات المنفّذة

### نظام المصادقة
- ✅ تسجيل حساب جديد (username + password + avatar)
- ✅ تسجيل دخول
- ✅ تسجيل خروج
- ✅ JWT cookie-based session
- ✅ كلمة المرور مشفّرة بـ bcrypt

### نظام الغرف
- ✅ إنشاء غرفة بكود سري 6 أحرف
- ✅ دخول غرفة بالكود
- ✅ تصفح الغرف المفتوحة
- ✅ Lobby مع قائمة اللاعبين المجهولين
- ✅ نسخ الكود بضغطة واحدة

### أوضاع اللعب
- ✅ **سؤال للجميع**: أي لاعب يطرح سؤالاً، الجميع يجيب مجهولاً
- ✅ **سؤال لشخص عشوائي**: النظام يختار لاعباً عشوائياً لك، ترسل له سؤالاً مجهولاً

### دورة الجولة (Round Lifecycle)
- ✅ **waiting**: Lobby، تجمع اللاعبين
- ✅ **answering**: 60 ثانية لطرح الأسئلة وكتابة الإجابات
- ✅ **revealing**: 30 ثانية لعرض الإجابات بدون أسماء
- ✅ **chatting**: 5 دقائق نقاش مباشر
- ✅ **finished**: إنهاء الجولة (يمكن بدء جديدة)
- ✅ Timer متحرك مع progress bar
- ✅ انتقال تلقائي للمنشئ عبر الأطوار

### الإخفاء (Anonymity)
- ✅ كل لاعب يحصل على اسم مجهول عشوائي (مثل "Shadow Raven")
- ✅ sender_id في questions لا يُكشف في API responses
- ✅ user_id في answers لا يُكشف
- ✅ messages تخزّن anonymous_user فقط
- ✅ RLS policies تمنع وصول اللاعبين لبيانات خارج غرفهم

### Realtime
- ✅ تحديث قائمة اللاعبين لحظياً (polling كل 2 ثانية)
- ✅ تحديث الأسئلة والإجابات لحظياً
- ✅ شات مباشر (polling كل 1 ثانية)
- ✅ مؤشر "مباشر" متحرك
- ✅ انتقال تلقائي بين الشاشات عند تغيّر حالة الغرفة

### التصميم
- ✅ Dark Mode (ثيم بنفسجي/أزرق غامق)
- ✅ Responsive (موبايل + كمبيوتر)
- ✅ Animations (Framer Motion)
- ✅ Cards للأسئلة والإجابات
- ✅ Countdown Timer
- ✅ خلفيات متدرجة وتأثيرات glow
- ✅ دعم RTL عربي كامل
- ✅ Avatars (إيموجي)

---

## 4. بنية المشروع

```
src/
├── app/
│   ├── api/                    # Next.js API Routes
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   ├── register/route.ts
│   │   │   ├── logout/route.ts
│   │   │   └── me/route.ts
│   │   ├── rooms/
│   │   │   ├── route.ts        # GET list / POST create
│   │   │   ├── join/route.ts
│   │   │   ├── leave/route.ts  # GET state / POST leave
│   │   │   └── start/route.ts
│   │   ├── questions/
│   │   │   ├── route.ts        # GET list / POST create
│   │   │   └── random-assign/route.ts
│   │   ├── answers/route.ts    # GET list / POST submit
│   │   ├── messages/route.ts   # GET list / POST send
│   │   └── state/route.ts      # POST change status
│   ├── globals.css             # Dark mystery theme
│   ├── layout.tsx              # RTL + dark mode
│   └── page.tsx                # Main app (state-based navigation)
│
├── components/
│   ├── mystery/
│   │   ├── auth-screen.tsx     # Login/Register
│   │   ├── home-screen.tsx
│   │   ├── create-room-screen.tsx
│   │   ├── join-room-screen.tsx
│   │   ├── lobby-screen.tsx
│   │   ├── game-screen.tsx     # Main game UI
│   │   ├── chat-panel.tsx
│   │   ├── countdown-timer.tsx
│   │   ├── avatar-picker.tsx
│   │   ├── header.tsx
│   │   └── logo.tsx
│   └── ui/                     # shadcn/ui components
│
├── hooks/
│   ├── use-auth.ts             # Auth state
│   ├── use-polling.ts          # Realtime polling
│   └── use-toast.ts
│
└── lib/
    ├── auth.ts                 # JWT + bcrypt + anonymous name gen
    ├── db.ts                   # Prisma client
    ├── socket.ts               # (unused — kept for Supabase Realtime migration)
    ├── types.ts                # Shared types
    └── utils.ts

prisma/
└── schema.prisma               # DB schema (mirrors Supabase)

mini-services/mystery-game/     # (optional) socket.io service
```

---

## 5. كيف تعمل الـ Realtime؟

المشروع يستخدم **HTTP polling** بدلاً من WebSocket للأسباب التالية:
- موثوق في كل البيئات (بما فيها خلف proxies و CDNs)
- بسيط في الـ debugging
- لا يتطلب خدمة منفصلة
- كافٍ لحركة المرور في ألعاب الـ chat

### آلية العمل
1. الـ client يبعث طلب GET كل 1-2 ثانية للـ API
2. الـ API يرجع آخر حالة من قاعدة البيانات
3. الـ client يحدّث الـ UI

### الانتقال إلى Supabase Realtime

عند الانتقال لـ Supabase، استبدل `usePolling` بـ Supabase Realtime channels:

```typescript
import { supabase } from "@/lib/supabase";

useEffect(() => {
  const channel = supabase
    .channel(`room:${roomId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
      (payload) => {
        // أضف الرسالة الجديدة للـ state
      }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "questions", filter: `room_id=eq.${roomId}` },
      (payload) => { /* ... */ }
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
      (payload) => { /* تحديث حالة الغرفة */ }
    )
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}, [roomId]);
```

---

## 6. الأمان

### ما الذي يحمي الهوية المجهولة؟

1. **API responses لا تكشف user_id**:
   - `GET /api/questions` لا يرجع `senderId`
   - `GET /api/answers` لا يرجع `userId`
   - `GET /api/messages` يرجع `anonymousUser` فقط (وليس `userId`)

2. **RLS في Supabase** (عند الانتقال):
   - اللاعب لا يستطيع SELECT من `room_players` إلا في غرفه
   - اللاعب لا يستطيع رؤية `profiles` إلا لملفه الشخصي
   - لا يمكنه رؤية `answers.user_id` حتى لو كانت في الـ row

3. **أسماء مجهولة عشوائية**:
   - تُولّد عند الانضمام للغرفة
   - لا يمكن ربطها بالـ username الحقيقي
   - لا تتكرر داخل نفس الغرفة

4. **Session JWT**:
   - httpOnly cookie
   - تنتهي بعد 7 أيام
   - موقّعة بـ JWT_SECRET

---

## 7. استكشاف الأخطاء

### المشكلة: اللاعبون لا يرون التحديثات
**الحل**: تأكد أن `usePolling` يعمل بـ `enabled: true`. تحقق من Network tab في المتصفح.

### المشكلة: "تعذّر الدخول للغرفة"
**الحل**: تأكد أن الكود 6 أحرف كبيرة. الغرف المنتهية (status=finished) لا تقبل دخول جديد.

### المشكلة: الـ timer لا يتقدم تلقائياً
**الحل**: فقط **المنشئ** يمكنه تغيير حالة الغرفة. اللاعبون الآخرون يرون التحديث عبر polling.

### المشكلة: لا أرى حقل الإجابة
**الحل**: حالة الغرفة يجب أن تكون "answering". إذا انتهى الوقت، تنتقل تلقائياً لـ "revealing".

---

## 8. الترخيص

هذا المشروع مفتوح المصدر. استخدمه بحرية لمشاريعك.
