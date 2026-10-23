# Veralayam student experience — mobile integration notes

Scope: mobile only. Backend and web were read, not modified. Visual values are **estimated from nine scaled
Figma screenshots**, not extracted from Figma; no pixel accuracy is claimed. Nothing here was run on an emulator or device.

## Tenant gate
`useInstitutionExperience()` (`features/learning/experience-store.ts`, backed by `GET /learning/me/experience`) decides
everything. Standard schools keep the five original tabs and original screens; the institution experience swaps in
`VeralayamTabBar` (Home, Learn, Tasks, Profile) and keeps `notices` as a hidden route that the bell opens.
Institution-only routes (`academic-details`, `learning-insights`, `improvement-plan`) redirect standard schools to `/performance`.

## Scoped UI layer
`src/features/learning/veralayam-ui/` (tokens, Inter loading from `assets/fonts`, components, blocks, tab bar, screens).
Shared `design-system/` is untouched. Inter (OFL-1.1) was bundled as TTF because `npm install` of the font package
fails on a pre-existing peer-dependency conflict (`openapi-typescript` vs TypeScript 6).

## Endpoints used (all existing, student-authorised)
| Purpose | Endpoint |
|---|---|
| Subjects and chapters | `GET /courses?limit=100` (each course carries its `subject`) |
| Lessons with opened state, lesson detail and videos | `GET /learning/courses`, `GET /learning/courses/:id/lessons/:id` |
| Lessons of non-learning courses | `GET /courses/:id/lessons` (listed only; no detail screen) |
| Daily tasks / quizzes / homework | `GET /learning/me/tasks`, `GET /students/me/quizzes`, `GET /students/me/homework` |
| Home | `GET /learning/me/home` |
| Notifications, unread, read, read-all | `GET /notifications`, `/notifications/unread-count`, `PATCH /notifications/:id/read`, `/read-all` |
| Progress screens | `GET /students/me/performance` (rules-based, `aiGenerated: false`) |

## Missing backend contracts (not simulated)
1. **Chapter → video**: only lesson → video exists, inside a generated learning course. Chapters of ordinary courses have no video link.
2. **Chapter → quiz**: quizzes carry `subjectId` but no course/lesson link. Quizzes are therefore offered on the *subject* screen only.
3. **Reading material / e-books / audio**: the source library has no per-item publish flag and also holds internal `LEARNING_COURSE` records, so student-visible notes cannot be listed safely. The Notes and Reading tiles are disabled and say so. No e-book reader or audio player exists.
4. **Subject presentation**: `Subject` has name, code and description only. No short title, order or illustration; artwork is decorative and cycled by position.
5. **Programme / year / volume**: not modelled; nothing is invented.
6. **Institution timezone**: not exposed to the client, so due dates use the device timezone.
7. **Notification preferences and push**: no preference API and no device-token delivery. The screen says alerts appear in the app only.
8. **Forgot password**: still a backend placeholder; the profile points to administrator-issued activation links.
9. **Quiz rules**: one attempt, duration not enforced server-side; the UI never presents quizzes as timed exams.

## Behaviour changes to know about
* Institution Home no longer shows the mascot or the "Reduce animations" switch on Home (the Figma has neither). The switch moved to Profile and appears only when the mascot is enabled.
* The Tasks switcher has three segments (Daily, Quizzes, Homework) instead of the Figma's two, so no existing quiz or homework access is lost.
* The Videos tile opens the existing, un-restyled video library (`/learning-videos`).
