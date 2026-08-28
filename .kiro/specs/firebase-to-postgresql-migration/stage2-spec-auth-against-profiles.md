# Stage 2 Technical Specification — Auth Against Existing `profiles`

**Approved direction (user):** Adapt API to existing Supabase data. Do not re-migrate or reshape migrated rows. Identity = `profiles`. Membership tables are not people.

**Verified live (2026-08-06, project unpaused):**
- `public.users` / `public.refresh_tokens` — **MISSING**
- `auth.users` — **0 rows** (Supabase Auth unused)
- `profiles` — **701** rows; ids are Firebase-style UIDs; no password columns in `public`
- `hq_members` — **134** membership rows (`user_id` → profile id); not profiles
- `zone_members` — **0** rows currently (table exists; empty)
- Password/hash columns in `public` — **NONE**

---

## 0. Domain boundaries (law)

| Table | Meaning | Never treat as |
|---|---|---|
| `profiles` | **Person / identity** (`id`, email, name, role, `raw_data`, …) | Membership |
| `hq_members` | **HQ membership link** (`user_id`, `hq_group_id`, role/status, denormalized `user_email`/`user_name`) | A user/profile record |
| `zone_members` | **Zone membership link** (`user_id`, `zone_id`, role/status) | A user/profile record |

Rules:
1. JWT `sub` = `profiles.id` always.
2. `/auth/me` returns a **profile** (plus memberships looked up separately).
3. Listing HQ/zone members = join `hq_members`/`zone_members` **to** `profiles` by `user_id = profiles.id`. Never invent a profile from membership denormalized fields alone when a profile exists; denormalized email/name are display fallbacks only.
4. Do not UPDATE/DELETE migrated `profiles` / membership rows except through intentional product write APIs later. This Stage only **adds** credential/token tables and adapts auth code.

---

## 1. Structural interface alterations

### 1.1 Additive tables only (create if not exists — do not touch migrated tables)

```sql
CREATE TABLE IF NOT EXISTS auth_credentials (
  profile_id TEXT PRIMARY KEY REFERENCES profiles(id),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS refresh_tokens_profile_id_idx ON refresh_tokens(profile_id);
```

- Drop Drizzle `users` table definition from active auth paths (or leave unused — must not be required at runtime).
- `refresh_tokens.user_id` stores `profiles.id` (Drizzle field `profileId` maps to physical column `user_id`; FK → `profiles`, not a `users` table).

### 1.2 Align `profiles` Drizzle to live columns

Live columns:  
`id, email, first_name, last_name, role, has_hq_access, avatar_url, created_at, raw_data, kingschat_id, profile_completed, updated_at`

Map:
- `avatar` → `avatar_url` (or rename field to `avatarUrl` → `avatar_url`)
- Fields only in `raw_data` (church, region, designation, zone codes, device ids, etc.): read via `raw_data` merge helper; do not require missing columns.

### 1.3 Auth service behavior

| Endpoint | Behavior |
|---|---|
| `POST /auth/login` | Find `profiles` by lowercased email. Load `auth_credentials` by `profile_id`. Verify bcrypt. If no credential row → generic `Invalid credentials` (same as wrong password). Issue JWT `sub=profile.id`, role from profile (map `user`→member semantics in token if needed). Store refresh on `refresh_tokens.profile_id`. |
| `POST /auth/register` | **Only** insert new `profiles` row + `auth_credentials` if email not in `profiles`. Never overwrite existing migrated profile. Id: prefer client/Firebase-style id if provided, else generate stable text id. |
| `POST /auth/reset-password` | If profile exists by email: upsert `auth_credentials` with new hash (identity form / admin-assisted). Does not mutate other profile fields. |
| `GET /auth/me` | Load `profiles` by JWT `sub`. Attach memberships: `{ zoneMembers: [...], hqMembers: [...] }` from membership tables filtered by `user_id = sub` — these are membership DTOs, not nested “profile replacements”. |
| `POST /auth/kingschat-login` | Resolve `profiles` by `kingschat_id` / raw_data; issue tokens for that `profiles.id`. No Supabase Auth. |
| Refresh / logout | Operate on `refresh_tokens.profile_id`. |

### 1.4 Members routes (clarify contracts)

- `GET /members/mine` — returns membership rows for JWT user (`zone_members` + `hq_members` where `user_id = sub`).
- `GET /members/hq`, `GET /members/hq/:hqGroupId`, `GET /members/zone/:zoneId` — return **membership** rows. Optional enrichment: if `?enrich=1`, join profile directory fields by `user_id`; still return membership id as membership id, profile as `profile: {…}` sibling — never collapse into a fake profile id = membership id.

---

## 2. Data contracts

```ts
// Auth user payload (always a profile)
type AuthUser = {
  id: string;          // profiles.id
  email: string;
  role: string;        // from profiles.role
  zoneId: string | null; // from membership or raw_data zone if present — not from inventing users.zone_id
  firstName?: string | null;
  lastName?: string | null;
};

// Membership DTO (not a profile)
type MembershipDto = {
  id: string;          // hq_members.id or zone_members.id
  userId: string;      // profiles.id FK
  role?: string | null;
  status?: string | null;
  hqGroupId?: string | null;
  zoneId?: string | null;
  userEmail?: string | null;  // denormalized fallback only
  userName?: string | null;
};
```

---

## 3. Error-handling matrix

| Case | HTTP | Client message |
|---|---|---|
| Unknown email / no credential / bad password | 401 | `Invalid credentials` |
| Register email already in `profiles` | 409 | `Email already registered` |
| Weak password | 400 | Generic password rule message |
| `/auth/me` unknown profile id | 401 | Unauthorized |
| DB error | 500 | `Something went wrong` (log server-side) |

Never leak “profile exists but no password set” as a distinct client error (account enumeration).

---

## 4. Type-safety & boundaries

- Clients talk only to `rehearsalhub-api`.
- No Supabase Auth / Firebase Auth for session restore.
- No writes that “convert” `hq_members`/`zone_members` into `profiles`.
- Pin any new deps exactly; do not touch `/api/master-songs` or `/api/praise-night-songs`.

---

## 5. Verification plan

1. `CREATE TABLE IF NOT EXISTS` for `auth_credentials` + `refresh_tokens` against live DB (additive).
2. `npm run build` in `rehearsalhub-api`.
3. Smoke:
   - Login with email that has no credential → 401 generic.
   - Reset/set password for an existing `profiles.email` → credential row created; login succeeds; JWT `sub` = that profile id.
   - `GET /auth/me` → profile fields; memberships array from `hq_members` (and empty `zone_members` OK).
   - `GET /members/hq/:id` → membership rows; `user_id` values exist in `profiles` when linked.
4. Confirm `SELECT COUNT(*) FROM profiles` unchanged by auth tests (except intentional register of a brand-new email).
5. Aikido scan on changed auth files (after user login).

---

## 6. Stage 3 micro-tasks (after “Approved. Proceed to Stage 3”)

1. Fix Drizzle `profiles` (+ drop auth dependency on missing `users`); add `auth_credentials` + `refresh_tokens(profile_id)`.
2. Apply additive SQL to live DB; verify tables exist.
3. Rewrite `auth.service` login/register/refresh/logout/me/kingschat against `profiles` + credentials.
4. Adjust members responses / comments so HQ/zone members are membership DTOs.
5. Smoke login + `/auth/me` + members against live Supabase; update `tasks.md` notes.

---

**Halt:** Reply **Approved. Proceed to Stage 3.** to implement.
