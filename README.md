# 🏋️ Fitness Planner — MERN Stack Workout Tracker

A full-stack workout tracking application built with the **MERN stack**
(MongoDB, Express, React, Node.js). Users can log workouts with a title,
weight ("load"), and rep count, view them in a live-updating list, and
delete entries — all backed by a real REST API and a persistent MongoDB
database.

Built to practice end-to-end full-stack development: designing a REST API,
modeling data with Mongoose, and wiring up a React front end that talks to
it in real time.

## ✨ Features

- **Create workouts** — log a title, load, and reps through a validated form
- **View all workouts** — fetched from the database, sorted newest-first
- **Delete workouts** — remove entries instantly, no page reload
- **Validation** — client-side (highlighting empty fields) and server-side
  (rejecting incomplete submissions with a clear JSON error message)

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, React Router, Context API |
| Backend | Node.js, Express 5 |
| Database | MongoDB (Atlas), Mongoose ODM |
| Tooling | Create React App, nodemon, dotenv |

## 💡 Skills Demonstrated

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

## 📡 API Endpoints

Base URL: `/api/workouts`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/workouts` | Get all workouts |
| `GET` | `/api/workouts/:id` | Get a single workout by ID |
| `POST` | `/api/workouts` | Create a new workout |
| `PATCH` | `/api/workouts/:id` | Update an existing workout |
| `DELETE` | `/api/workouts/:id` | Delete a workout by ID |

## 🚀 Running Locally

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
```

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

## 🔭 Future Improvements

- User authentication (sign up / log in, per-user workout data)
- Automated tests for API routes and React components
- Additional pages/routes (workout history, editing UI)
