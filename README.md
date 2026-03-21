# Macro Trader

Macro Trader is a real-time multiplayer economic simulation game built for a college event. Teams act as fictional nations, submit policy decisions each round, and the simulation engine updates macroeconomic outcomes for both the team view and the live admin dashboard.

## Stack

- Next.js App Router
- Tailwind CSS + shadcn/ui
- Prisma + PostgreSQL
- JWT cookie auth
- Recharts for dashboard visualization

## Core Routes

- `/login`: admin/team login
- `/team`: nation dashboard with economy metrics, global intelligence, diplomacy, and news
- `/team/decide`: round decision submission
- `/admin`: projector-friendly live dashboard
- `/admin/control`: round flow and event controls
- `/admin/setup`: seed default teams or create teams manually

## Setup

Create `macro-trader/.env` with:

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="replace-this-in-production"
```

Install dependencies and start the app:

```bash
cd macro-trader
npm install
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

For local development with a fresh database, `npx prisma migrate dev` also works.

## Notes

- Admin accounts and team users are stored in the database with bcrypt-hashed passwords.
- The simulation engine lives in `src/lib/simulation`.
- The admin dashboard uses the weighted game scoring model from the project spec.
