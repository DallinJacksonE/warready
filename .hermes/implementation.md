# War Ready implementation checklist

## Scope and decisions
- Original readme.md is retained as the product brief.
- TypeScript React/Vite frontend, Express API, MySQL 8.4; single-origin deployment.
- Two bootstrap accounts only; no public registration. Visitors read all journal entries, calendar events, and profiles. All saved journal entries are public (explicit in UI).
- Owners alone may create/update/delete their journals/events and edit their profile.
- 1,000 lb club means sum of best recorded squat, bench, deadlift one-rep maxes in lb, not three-rep maxes. This interpretation needs owner confirmation before changing training practices.
- Fitness training target defaults: 23 pull-ups, 3:45 plank, 18:00 three-mile run; editable per profile. This is NOT official Marine PFT scoring, which depends on age/sex and current rules. Progress is the equally weighted capped fraction toward these three personal targets; missing metrics count zero.
- Metrics are optional observations attached to journal dates; timeline re-derives records after edits/deletes. Max strength and reps/plank, minimum run time. No fabricated workout history.
- Calendar dates are date-only; no timezone shifts. Goal date: 2027-10-16.
- Text file import is client-side UTF-8 .txt/.md, plain text display, no HTML execution.
- Local bind only by default; random bootstrap credentials in ignored .env; persistent MySQL volume. No destructive volume commands or deployments.

## Checklist
- [x] Inspect brief; define shared transport contracts and build configuration.
- [ ] Backend tests, persistent repository, sessions, CSRF, owner authorization, CRUD.
- [ ] React service/presenter, public pages, owner editors, calendar and lookback.
- [ ] Domain calculation tests and implementation.
- [ ] Docker build and health readiness.
- [ ] Live HTTP + SQL + browser CRUD/security checks.
- [ ] Setup, backup, limitations and verification documentation.
