# Fitness Planner — MERN Stack Workout Tracker

A full-stack workout tracking application built with the **MERN stack**
(MongoDB, Express, React, Node.js). Users sign up or log in, then log
workouts with a title, weight ("load"), and rep count, view them in a
live-updating list, and delete entries — all backed by a real REST API, a
persistent MongoDB database, and JWT authentication that keeps each user's
workouts private.

Built to practice end-to-end full-stack development: designing a REST API,
modeling data with Mongoose, and wiring up a React front end that talks to
it in real time.

## Features

- **User accounts** — sign up and log in with an email and password;
  passwords are hashed with bcrypt and must meet strength requirements
- **Private, per-user workouts** — each user only sees and manages their
  own workouts; all workout endpoints require a valid JWT
- **Persistent sessions** — the logged-in user is kept in `localStorage`, so
  a page refresh doesn't log you out; logging out clears it
- **Protected routes** — logged-out visitors are redirected to `/login`, and
  logged-in users are redirected away from `/login` and `/signup`
- **Create workouts** — log a title, load, and reps through a validated form
- **View all workouts** — fetched from the database, sorted newest-first
- **Delete workouts** — remove entries instantly, no page reload
- **Validation** — client-side (highlighting empty fields) and server-side
  (rejecting incomplete submissions with a clear JSON error message)

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router, Context API |
| Backend | Node.js, Express 5, JSON Web Tokens, bcrypt, validator |
| Database | MongoDB (Atlas), Mongoose ODM |
| Tooling | Create React App, nodemon, dotenv |

## Skills Demonstrated

- **Express routing & middleware** — a dedicated router mounted under
  `/api/workouts`, plus custom middleware for request logging and JSON
  body parsing.
- **RESTful API design** — full CRUD endpoints following REST conventions
  (see table below) with consistent JSON responses.
- **MongoDB & Mongoose** — a defined schema with typed, required fields and
  automatic `createdAt`/`updatedAt` timestamps.
- **React component architecture** — a clean split between presentational
  components (`WorkoutDetails`), forms (`WorkoutForm`), navigation (`Nav`),
  and page-level composition (`Home`).
- **Custom hooks & global state** — a `useWorkoutsContext` hook built on
  React's Context API + `useReducer` to share workout state across
  components without prop-drilling.
- **Frontend ↔ backend communication** — React calls the Express API via
  `fetch`, Express reads/writes MongoDB via Mongoose, completing the full
  request lifecycle from UI to database and back.
- **JWT authentication** — the server signs a JWT (3-day expiry) on signup
  and login, and the client sends it as an `Authorization: Bearer <token>`
  header on every workout request.
- **Auth middleware & authorization** — a `requireAuth` Express middleware
  verifies the token and attaches the user to `req`; every workout query is
  scoped to that user's `user_id`, so one user can't read, edit, or delete
  another user's data.
- **Secure password handling** — passwords are salted and hashed with
  bcrypt, validated with `validator`, and login errors stay generic so they
  don't reveal which emails are registered.
- **Mongoose static methods** — `signup` and `login` logic lives on the
  `User` model, keeping the controllers thin.
- **Auth state in React** — an `AuthContext` with custom `useSignup`,
  `useLogin`, `useLogout`, and `useAuthContext` hooks, plus React Router
  redirects (`<Navigate>`) to guard pages.

## API Endpoints

**User** (public):

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/user/signup` | Create an account; returns `{ email, token }` |
| `POST` | `/api/user/login` | Log in; returns `{ email, token }` |

**Workouts** (require an `Authorization: Bearer <token>` header and only
operate on the logged-in user's workouts):

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/workouts` | Get all workouts |
| `GET` | `/api/workouts/:id` | Get a single workout by ID |
| `POST` | `/api/workouts` | Create a new workout |
| `PATCH` | `/api/workouts/:id` | Update an existing workout |
| `DELETE` | `/api/workouts/:id` | Delete a workout by ID |

## Running Locally

**Prerequisites:** Node.js, npm, and a MongoDB connection string (e.g. a
free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster).

```bash
git clone <this-repo-url>
cd "Fitness Planner Full Stack Project"
```

**Backend** — in `backend/`, run `npm install`, then create a `.env` file:

```
PORT=4000
DBURL=<your-mongodb-connection-string>
SECRET=<a-long-random-string-for-signing-jwts>
```

You can generate a secret with
`node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`.

Start the API server:

```bash
npm run dev
```

**Frontend** — in a separate terminal, in `frontend/`:

```bash
npm install
npm start
```

The React app runs on `http://localhost:3000` and proxies API requests to
Express on `http://localhost:4000` (via the `proxy` field in
`frontend/package.json`).

## Future Improvements

- Automated tests for API routes and React components
- Additional pages/routes (workout history, editing UI)