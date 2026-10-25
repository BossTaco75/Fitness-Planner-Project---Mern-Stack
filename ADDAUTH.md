# Adding JWT Authentication to Fitness Planner

This guide adds signup/login with JSON Web Tokens and makes each user's
workouts private to them. It is written against the current code:

- **Backend:** `backend/server.js` mounts `routes/workouts.js` at `/api/workouts`;
  `controllers/workoutController.js` queries `Workout` with no owner filter;
  `models/workoutModel.js` has `title`, `reps`, `load`.
- **Frontend:** CRA with `"proxy": "http://localhost:4000"`; one route (`/` → `Home`)
  in `App.js`; global state in `context/WorkoutContext.js`; `fetch` calls in
  `pages/Home.js`, `components/WorkoutForm.js`, `components/WorkoutDetails.js`.

Right now every visitor sees and can delete every workout. When you're done:

1. A user signs up or logs in → the server returns a signed JWT.
2. The frontend stores the token (in context + `localStorage`) and sends it as
   `Authorization: Bearer <token>` on every workout request.
3. Express middleware verifies the token and attaches the user's id to `req`.
4. Workout controllers only read/write documents whose `user_id` matches.

---

## Part 1 — Backend

### Step 1: Install dependencies

```bash
cd backend
npm install jsonwebtoken bcrypt validator
```

| Package | Purpose |
|---|---|
| `jsonwebtoken` | Sign and verify JWTs |
| `bcrypt` | Hash passwords (never store plain text). `bcryptjs` is a pure-JS alternative if native builds fail on Windows |
| `validator` | Check email format and password strength |

### Step 2: Add a JWT secret to `backend/.env`

```
PORT=4000
DBURL=...
SECRET=some-long-random-string
```

Generate a good one with:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

`.env` is already in `.gitignore`, so the secret won't be committed.

### Step 3: Create the User model — `backend/models/userModel.js`

Follow the same style as `workoutModel.js`. Put signup/login logic on the
model as static methods so the controller stays thin.

```js
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const validator = require('validator')

const Schema = mongoose.Schema

const userSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    }
})

//static signup method
userSchema.statics.signup = async function (email, password) {
    if (!email || !password) {
        throw Error('All fields must be filled')
    }
    if (!validator.isEmail(email)) {
        throw Error('Email is not valid')
    }
    if (!validator.isStrongPassword(password)) {
        throw Error('Password not strong enough')
    }

    const exists = await this.findOne({ email })
    if (exists) {
        throw Error('Email already in use')
    }

    const salt = await bcrypt.genSalt(10)
    const hash = await bcrypt.hash(password, salt)

    const user = await this.create({ email, password: hash })
    return user
}

//static login method
userSchema.statics.login = async function (email, password) {
    if (!email || !password) {
        throw Error('All fields must be filled')
    }

    const user = await this.findOne({ email })
    if (!user) {
        throw Error('Incorrect email or password')
    }

    const match = await bcrypt.compare(password, user.password)
    if (!match) {
        throw Error('Incorrect email or password')
    }

    return user
}

module.exports = mongoose.model('User', userSchema)
```

> Use `function`, not an arrow function, so `this` refers to the model.

### Step 4: Create the user controller — `backend/controllers/userController.js`

```js
const User = require('../models/userModel')
const jwt = require('jsonwebtoken')

const createToken = (_id) => {
    return jwt.sign({ _id }, process.env.SECRET, { expiresIn: '3d' })
}

//login user
const loginUser = async (req, res) => {
    const { email, password } = req.body

    try {
        const user = await User.login(email, password)
        const token = createToken(user._id)
        res.status(200).json({ email, token })
    }
    catch (err) {
        res.status(400).json({ error: err.message })
    }
}

//signup user
const signupUser = async (req, res) => {
    const { email, password } = req.body

    try {
        const user = await User.signup(email, password)
        const token = createToken(user._id)
        res.status(200).json({ email, token })
    }
    catch (err) {
        res.status(400).json({ error: err.message })
    }
}

module.exports = { signupUser, loginUser }
```

Only put non-sensitive data (the user id) in the payload — JWTs are signed,
not encrypted; anyone can decode them.

### Step 5: Create user routes — `backend/routes/user.js`

```js
const express = require('express')
const { loginUser, signupUser } = require('../controllers/userController')

const router = express.Router()

//POST login
router.post('/login', loginUser)

//POST signup
router.post('/signup', signupUser)

module.exports = router
```

### Step 6: Mount the user routes in `backend/server.js`

```js
const workoutRoutes = require('./routes/workouts');
const userRoutes = require('./routes/user');
...
server.use('/api/workouts', workoutRoutes);
server.use('/api/user', userRoutes);
```

Test now with Postman: `POST http://localhost:4000/api/user/signup` with
JSON body `{ "email": "test@test.com", "password": "Abc123!@#" }` should
return `{ email, token }`. Paste the token into https://jwt.io to see the
payload.

### Step 7: Create auth middleware — `backend/middleware/requireAuth.js`

```js
const jwt = require('jsonwebtoken')
const User = require('../models/userModel')

const requireAuth = async (req, res, next) => {
    //verify authentication
    const { authorization } = req.headers

    if (!authorization || !authorization.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization token required' })
    }

    const token = authorization.split(' ')[1]

    try {
        const { _id } = jwt.verify(token, process.env.SECRET)
        req.user = await User.findOne({ _id }).select('_id')
        if (!req.user) {
            return res.status(401).json({ error: 'Request is not authorized' })
        }
        next()
    }
    catch (err) {
        console.log(err)
        res.status(401).json({ error: 'Request is not authorized' })
    }
}

module.exports = requireAuth
```

### Step 8: Protect the workout routes — `backend/routes/workouts.js`

Add the middleware once, above all the route definitions, so it runs for
every workout endpoint:

```js
const requireAuth = require('../middleware/requireAuth')

const router = express.Router();

//require auth for all workout routes
router.use(requireAuth)

//GET all workouts
router.get('/', getAllWorkouts);
...
```

### Step 9: Add an owner field to the Workout model — `backend/models/workoutModel.js`

```js
    load: {
        type: Number,
        required: true      // also fixes the existing "requried" typo
    },
    user_id: {
        type: String,
        required: true
    }
}, { timestamps: true });
```

> Existing workouts in your DB have no `user_id`, so they will stop showing
> up. Either delete them in Atlas or assign them to your user's `_id`.

### Step 10: Scope every controller to the logged-in user — `backend/controllers/workoutController.js`

`req.user._id` is now available in every handler.

**getAllWorkouts** — only this user's workouts:
```js
const user_id = req.user._id
const workouts = await Workout.find({ user_id }).sort({ createdAt: -1 });
```

**createWorkout** — save the owner:
```js
const user_id = req.user._id
const workout = await Workout.create({ title, reps, load, user_id });
```

**getWorkout / deleteWorkout / updateWorkout** — include the owner in the
query, so a user can't touch someone else's workout by guessing an id:
```js
const workout = await Workout.findOne({ _id: id, user_id: req.user._id });
const workout = await Workout.findOneAndDelete({ _id: id, user_id: req.user._id });
const workout = await Workout.findOneAndUpdate(
    { _id: id, user_id: req.user._id },
    { ...req.body },
    { new: true }
);
```

In `updateWorkout`, also strip `user_id` from `req.body` (e.g.
`const { user_id, ...updates } = req.body`) so a user can't reassign
ownership via PATCH.

Verify in Postman: workout requests without a header → `401`; with
`Authorization: Bearer <token>` → only that user's data.

---

## Part 2 — Frontend

### Step 11: Create an AuthContext — `frontend/src/context/AuthContext.js`

Mirror the structure of `WorkoutContext.js`:

```js
import { createContext, useReducer, useEffect } from 'react'

export const AuthContext = createContext()

export const authReducer = (state, action) => {
    switch (action.type) {
        case 'LOGIN':
            return { user: action.payload }
        case 'LOGOUT':
            return { user: null }
        default:
            return state
    }
}

export const AuthContextProvider = ({ children }) => {
    const [state, dispatch] = useReducer(authReducer, {
        user: null
    })

    //restore a logged-in user on page refresh
    useEffect(() => {
        const user = JSON.parse(localStorage.getItem('user'))
        if (user) {
            dispatch({ type: 'LOGIN', payload: user })
        }
    }, [])

    return (
        <AuthContext.Provider value={{ ...state, dispatch }}>
            {children}
        </AuthContext.Provider>
    )
}
```

### Step 12: Add `useAuthContext` — `frontend/src/hooks/useAuthContext.js`

Same pattern as `useWorkoutsContext.js`:

```js
import { AuthContext } from '../context/AuthContext'
import { useContext } from 'react'

export const useAuthContext = () => {
    const context = useContext(AuthContext)

    if (!context) {
        throw Error('useAuthContext must be used inside an AuthContextProvider')
    }

    return context
}
```

### Step 13: Wrap the app — `frontend/src/index.js`

```js
import { AuthContextProvider } from './context/AuthContext';
...
<React.StrictMode>
    <AuthContextProvider>
        <WorkoutsContextProvider>
            <App />
        </WorkoutsContextProvider>
    </AuthContextProvider>
</React.StrictMode>
```

### Step 14: Create `useSignup`, `useLogin`, `useLogout` hooks — `frontend/src/hooks/`

**useSignup.js**
```js
import { useState } from 'react'
import { useAuthContext } from './useAuthContext'

export const useSignup = () => {
    const [error, setError] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const { dispatch } = useAuthContext()

    const signup = async (email, password) => {
        setIsLoading(true)
        setError(null)

        const response = await fetch('/api/user/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        })
        const json = await response.json()

        if (!response.ok) {
            setIsLoading(false)
            setError(json.error)
        }
        if (response.ok) {
            localStorage.setItem('user', JSON.stringify(json))
            dispatch({ type: 'LOGIN', payload: json })
            setIsLoading(false)
        }
    }

    return { signup, isLoading, error }
}
```

**useLogin.js** — identical to `useSignup`, but named `login` and posting to
`/api/user/login`.

**useLogout.js**
```js
import { useAuthContext } from './useAuthContext'
import { useWorkoutsContext } from './useWorkoutsContext'

export const useLogout = () => {
    const { dispatch } = useAuthContext()
    const { dispatch: workoutsDispatch } = useWorkoutsContext()

    const logout = () => {
        localStorage.removeItem('user')
        dispatch({ type: 'LOGOUT' })
        workoutsDispatch({ type: 'SET_WORKOUTS', payload: null })  //clear previous user's workouts
    }

    return { logout }
}
```

Logging out with JWT is purely client-side: delete the token. (The token is
still technically valid until it expires — that's the stateless trade-off.)

### Step 15: Create Login and Signup pages — `frontend/src/pages/`

**Signup.js**
```js
import { useState } from 'react'
import { useSignup } from '../hooks/useSignup'

const Signup = () => {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const { signup, error, isLoading } = useSignup()

    const handleSubmit = async (e) => {
        e.preventDefault()
        await signup(email, password)
    }

    return (
        <form className="signup" onSubmit={handleSubmit}>
            <h3>Sign Up</h3>

            <label>Email address:</label>
            <input
                type="email"
                onChange={(e) => setEmail(e.target.value)}
                value={email}
            />
            <label>Password:</label>
            <input
                type="password"
                onChange={(e) => setPassword(e.target.value)}
                value={password}
            />

            <button disabled={isLoading}>Sign up</button>
            {error && <div className="error">{error}</div>}
        </form>
    )
}

export default Signup
```

**Login.js** — same form, using `useLogin`, heading "Log In", className `login`.

Add some CSS in `index.css` for `form.signup, form.login` (e.g. `max-width:
400px; margin: 40px auto; padding: 20px; background: #fff; border-radius: 4px;`).

### Step 16: Add routes and redirects — `frontend/src/App.js`

```js
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthContext } from './hooks/useAuthContext'

//pages and components
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Nav from './components/Nav'

function App() {
  const { user } = useAuthContext()

  return (
    <div className="App">
      <BrowserRouter>
        <Nav />
        <div className='pages'>
          <Routes>
            <Route path='/' element={user ? <Home /> : <Navigate to='/login' />} />
            <Route path='/login' element={!user ? <Login /> : <Navigate to='/' />} />
            <Route path='/signup' element={!user ? <Signup /> : <Navigate to='/' />} />
          </Routes>
        </div>
      </BrowserRouter>
    </div>
  );
}
```

> **Refresh flicker:** `user` starts as `null` before the `useEffect` in
> AuthContext reads `localStorage`, so a refresh on `/` briefly redirects to
> `/login`. Fix it by initializing state directly instead:
> `useReducer(authReducer, { user: JSON.parse(localStorage.getItem('user')) })`
> (and then the `useEffect` isn't needed).

### Step 17: Update the navbar — `frontend/src/components/Nav.js`

```js
import { Link } from 'react-router-dom'
import { useLogout } from '../hooks/useLogout'
import { useAuthContext } from '../hooks/useAuthContext'

const Nav = () => {
    const { logout } = useLogout()
    const { user } = useAuthContext()

    return (
        <header>
            <div className="container">
                <Link to="/">
                    <h1>Fitness Planner</h1>
                </Link>
                <nav>
                    {user && (
                        <div>
                            <span>{user.email}</span>
                            <button onClick={logout}>Log out</button>
                        </div>
                    )}
                    {!user && (
                        <div>
                            <Link to="/login">Login</Link>
                            <Link to="/signup">Signup</Link>
                        </div>
                    )}
                </nav>
            </div>
        </header>
    )
}
```

Add CSS for `nav` (e.g. `display: flex; align-items: center;` and margins
on its links/button) — `header .container` already uses flex.

### Step 18: Send the token on every workout request

**`pages/Home.js`**
```js
const { workouts, dispatch } = useWorkoutsContext()
const { user } = useAuthContext()

useEffect(() => {
    const fetchWorkouts = async () => {
        const reponse = await fetch('/api/workouts', {
            headers: { 'Authorization': `Bearer ${user.token}` }
        })
        ...
    }
    if (user) {
        fetchWorkouts();
    }
}, [dispatch, user])
```

**`components/WorkoutForm.js`**
```js
const { user } = useAuthContext()

const handleSubmit = async (e) => {
    e.preventDefault()

    if (!user) {
        setError('You must be logged in')
        return
    }
    ...
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${user.token}`
    }
```

**`components/WorkoutDetails.js`**
```js
const { user } = useAuthContext()

const handleClick = async () => {
    if (!user) {
        return
    }
    const response = await fetch('/api/workouts/' + workout._id, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${user.token}` }
    })
```

> Note the leading slash: the current code uses `'api/workouts/'` (relative),
> which only works while you're on `/`. Once you have more routes, make it
> `'/api/workouts/'`.

### Step 19 (optional): Handle expired tokens

Tokens expire after 3 days (`expiresIn: '3d'`). When any workout request
returns `401`, call `logout()` so the user is sent back to `/login` instead
of seeing an empty page.

---

## Part 3 — Test checklist

- [ ] Sign up with a weak password → "Password not strong enough"
- [ ] Sign up with a used email → "Email already in use"
- [ ] Sign up successfully → redirected to `/`, email shown in navbar, `user` in localStorage
- [ ] Add workouts, refresh page → still logged in, workouts still shown
- [ ] Log out → redirected to `/login`, workouts cleared, localStorage empty
- [ ] Log in as a second user → sees none of the first user's workouts
- [ ] Postman: `GET /api/workouts` with no header → `401`
- [ ] Postman: `DELETE /api/workouts/<other user's id>` with your token → `404`
- [ ] Postman: tampered/expired token → `401`

---

## Summary of file changes

| File | Change |
|---|---|
| `backend/package.json` | + `jsonwebtoken`, `bcrypt`, `validator` |
| `backend/.env` | + `SECRET` |
| `backend/models/userModel.js` | **new** — schema + `signup`/`login` statics |
| `backend/controllers/userController.js` | **new** — `createToken`, `signupUser`, `loginUser` |
| `backend/routes/user.js` | **new** — `POST /login`, `POST /signup` |
| `backend/middleware/requireAuth.js` | **new** — verify Bearer token, set `req.user` |
| `backend/server.js` | mount `/api/user` |
| `backend/routes/workouts.js` | `router.use(requireAuth)` |
| `backend/models/workoutModel.js` | + `user_id`; fix `requried` typo |
| `backend/controllers/workoutController.js` | filter/create/update/delete by `user_id` |
| `frontend/src/context/AuthContext.js` | **new** |
| `frontend/src/hooks/useAuthContext.js` | **new** |
| `frontend/src/hooks/useSignup.js`, `useLogin.js`, `useLogout.js` | **new** |
| `frontend/src/pages/Signup.js`, `Login.js` | **new** |
| `frontend/src/index.js` | wrap in `AuthContextProvider` |
| `frontend/src/App.js` | `/login`, `/signup` routes + redirects |
| `frontend/src/components/Nav.js` | login/signup links, email + logout button |
| `frontend/src/pages/Home.js` | send token; only fetch when logged in |
| `frontend/src/components/WorkoutForm.js` | send token |
| `frontend/src/components/WorkoutDetails.js` | send token; fix relative URL |
| `frontend/src/index.css` | styles for auth forms and nav |

## Security notes

- Storing the JWT in `localStorage` is simple and fine for a learning project,
  but it's readable by any JavaScript on the page (XSS risk). The more
  hardened option is an `httpOnly` cookie set by the server.
- Keep login error messages generic ("Incorrect email or password") so they
  don't reveal which emails are registered.
- Never commit `SECRET`; if it leaks, rotate it (which logs out everyone).


---

# Implementation Review (2026-10-24)

I checked the current code against the steps above. Right now **the frontend
won't compile and signup/login always fail**, so nothing works from start to
finish yet. Fix the items below in order. Items 1–6 are blockers.

## Blockers

### 1. `frontend/src/hooks/useAuthContext.js` is empty (Step 12)

`App.js`, `Nav.js`, `Home.js`, `WorkoutDetails.js`, and all the auth hooks import
`useAuthContext` from this file, but the file is 0 bytes. CRA fails to build
with `export 'useAuthContext' (imported as 'useAuthContext') was not found`.
Fill it in with the code from Step 12:

```js
import { AuthContext } from '../context/AuthContext'
import { useContext } from 'react'

export const useAuthContext = () => {
    const context = useContext(AuthContext)

    if (!context) {
        throw Error('useAuthContext must be used inside an AuthContextProvider')
    }

    return context
}
```

### 2. `frontend/src/context/AuthContext.js` imports `userReducer` instead of `useReducer` (Step 11)

```js
import { createContext, userReducer, useEffect } from 'react'   // wrong
...
const [state, dispatch] = userReducer(authReducer, { ... })      // wrong
```

React doesn't export `userReducer`, so it is `undefined`, and the provider
crashes with `userReducer is not a function` (blank page). Change both
occurrences to `useReducer`.

Also apply the **refresh flicker** fix from Step 16 while you're here. Without
it, refreshing on `/` sends a logged-in user to `/login` and back:

```js
const [state, dispatch] = useReducer(authReducer, {
    user: JSON.parse(localStorage.getItem('user'))
})
// then delete the useEffect (and the useEffect import)
```

### 3. `createToken` in `backend/controllers/userController.js` is malformed (Step 4)

```js
return jwt.sign({ _id }), process.env.SECRET, (expiresIn, '3d')   // wrong
```

The parentheses close `jwt.sign(...)` too early. Everything after it is a
comma expression, so `jwt.sign` is called with **no secret** and throws
`secretOrPrivateKey must have a value`. Both `/signup` and `/login` therefore
always return `400`. Worse, on signup the user is **already saved** before the
token step fails, so retrying gives "Email already in use". Delete any test
users created this way.

```js
const createToken = (_id) => {
    return jwt.sign({ _id }, process.env.SECRET, { expiresIn: '3d' })
}
```

### 4. `backend/models/workoutModel.js` is missing the `user_id` field (Step 9)

Only the `requried` typo was fixed. The controllers now pass `user_id` to
`Workout.create(...)`, but Mongoose's strict mode **silently drops fields that
aren't in the schema**. As a result:

- new workouts are saved with no owner,
- `Workout.find({ user_id })` matches nothing, so every user sees an empty list,
- get/delete/update by id always return `404`.

Add the field:

```js
    load: {
        type: Number,
        required: true
    },
    user_id: {
        type: String,
        required: true
    }
}, { timestamps: true });
```

After this, delete (or assign a `user_id` to) any workouts already in Atlas
that have no `user_id`.

### 5. `frontend/src/hooks/useLogin.js` posts to the signup endpoint (Step 14)

```js
const response = await fetch('/api/user/signup', {   // wrong
```

Logging in with an existing account returns "Email already in use", and
"logging in" with a new email quietly **creates an account**. Change it to
`'/api/user/login'`.

### 6. `frontend/src/components/WorkoutForm.js` was not updated (Step 18)

The POST still sends no `Authorization` header, so every "Add" returns `401
Authorization token required`. Update it:

```js
import { useAuthContext } from "../hooks/useAuthContext"
...
const { user } = useAuthContext()

const handleSubmit = async (e) => {
    e.preventDefault()

    if (!user) {
        setError('You must be logged in')
        return
    }

    const workout = { title, load, reps }

    const reponse = await fetch('/api/workouts', {
        method: 'POST',
        body: JSON.stringify(workout),
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token}`
        }
    })
    ...
```

## Bugs that don't block the flow

### 7. `backend/models/userModel.js`: misspelled schema options (Step 3)

```js
email: {
    type: String,
    require: true,    // should be: required
    unqiue: true      // should be: unique
},
```

Mongoose ignores both misspelled keys. The `findOne` check in `signup`
catches most duplicates. However, two signups for the same email that arrive
at the same moment can both succeed, because no unique index exists. Fix the
spelling. Mongoose builds the unique index when the app starts. If the
`users` collection already has duplicate emails, delete them first or the index
won't be created.

### 8. `frontend/src/index.css`: auth-form selector is missing a comma (Step 15)

```css
form.signup form.login { ... }    /* means: a form.login INSIDE a form.signup → matches nothing */
```

Change it to:

```css
form.signup, form.login { ... }
```

Optionally add spacing for the nav items as Step 17 suggests, e.g.
`nav a, nav button { margin-left: 10px; }`. Right now the email, the Log out
button, and the Login/Signup links have no space between them.

## Optional / cleanup

### 9. Expired-token handling (Step 19) is not implemented

After 3 days the token expires and `GET /api/workouts` returns `401`. `Home.js`
ignores the failed response, so the user sees an empty page while still
"logged in". Call `logout()` when any workout request returns `401`. Do this in
`Home.js`, `WorkoutForm.js`, and `WorkoutDetails.js`.

### 10. Unused imports in `frontend/src/components/WorkoutDetails.js`

`formatDistance` and the default import `formDistanceToNow` are never used
(ESLint warnings only). Simplify to:

```js
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow'
```

### 11. Loading state can get stuck in `useSignup` / `useLogin`

If `fetch` throws (e.g. the backend isn't running), `isLoading` stays `true`
and the button stays disabled. Wrap the request in `try/catch`, then call
`setError(...)` and `setIsLoading(false)` in the `catch`.

## Verified as correct

- `backend/.env` has `SECRET`, and `.env` is git-ignored.
- `backend/package.json` includes `bcrypt`, `jsonwebtoken`, `validator`.
- `backend/routes/user.js` and the `/api/user` mount in `server.js` are correct.
- `backend/middleware/requireAuth.js` is correct.
- `backend/routes/workouts.js` applies `router.use(requireAuth)` before all routes.
- `backend/controllers/workoutController.js` scopes every query to
  `req.user._id` and strips `user_id` from PATCH bodies. This is correct, but
  it only works once item 4 is fixed.
- `userModel` `signup`/`login` statics work, and they return the generic
  "Incorrect email or password".
- `index.js` provider nesting, `App.js` routes/redirects, `Nav.js`,
  `useLogout.js`, `useSignup.js`, `Login.js`, `Signup.js`, and `Home.js`
  are correct.
- `WorkoutDetails.js` sends the token and uses the fixed absolute URL `/api/workouts/`.

## Fix checklist

| # | File | Change |
|---|---|---|
| 1 | `frontend/src/hooks/useAuthContext.js` | Write the hook (file is empty) |
| 2 | `frontend/src/context/AuthContext.js` | `userReducer` → `useReducer`; lazy-init from `localStorage` |
| 3 | `backend/controllers/userController.js` | Fix `jwt.sign(payload, secret, { expiresIn: '3d' })` |
| 4 | `backend/models/workoutModel.js` | Add `user_id: { type: String, required: true }` |
| 5 | `frontend/src/hooks/useLogin.js` | POST to `/api/user/login` |
| 6 | `frontend/src/components/WorkoutForm.js` | Send `Authorization` header; guard on `user` |
| 7 | `backend/models/userModel.js` | `require` → `required`, `unqiue` → `unique` |
| 8 | `frontend/src/index.css` | `form.signup, form.login` (add comma); nav spacing |
| 9 | `Home.js` / `WorkoutForm.js` / `WorkoutDetails.js` | (optional) log out on `401` |
| 10 | `frontend/src/components/WorkoutDetails.js` | (optional) remove unused imports |
| 11 | `useSignup.js` / `useLogin.js` | (optional) `try/catch` around `fetch` |

After fixing, run through the **Part 3 — Test checklist** above.
