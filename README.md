# Assignment Portal – Backend

Node.js + Express.js REST API for the Assignment Workflow Portal.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite (via better-sqlite3)
- **Auth**: JWT (jsonwebtoken + bcryptjs)
- **Validation**: express-validator

## Setup & Run

```bash
# 1. Install dependencies
npm install

# 2. Seed demo users
npm run seed

# 3. Start dev server (port 5000)
npm run dev
```

## Demo Credentials

| Role    | Email               | Password    |
|---------|---------------------|-------------|
| Teacher | teacher1@portal.com | teacher123  |
| Teacher | teacher2@portal.com | teacher123  |
| Student | student1@portal.com | student123  |
| Student | student2@portal.com | student123  |
| Student | student3@portal.com | student123  |

## API Endpoints

### Auth
- `POST /api/auth/login` – Login (returns JWT + role)

### Assignments (Teacher)
- `GET    /api/assignments`               – List with filters & pagination
- `POST   /api/assignments`               – Create (Draft)
- `PUT    /api/assignments/:id`           – Edit (Draft only)
- `DELETE /api/assignments/:id`           – Delete (Draft only)
- `PATCH  /api/assignments/:id/status`    – Transition status
- `GET    /api/assignments/:id/submissions` – View submissions
- `PATCH  /api/assignments/submissions/:id/review` – Mark reviewed

### Assignments (Student)
- `GET  /api/assignments/published`        – List published
- `POST /api/assignments/:id/submit`       – Submit answer
- `GET  /api/assignments/:id/my-submission` – View own submission

### Dashboard
- `GET /api/assignments/dashboard/stats` – Teacher analytics

## Assumptions
- SQLite database stored at `./data/portal.db` (auto-created)
- JWT tokens expire after 24 hours
- Submissions blocked after assignment due date
