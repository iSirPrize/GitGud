# GitGud

A gaming clip voting platform built with React, Firebase, and Express.

## Tech Stack
- **Frontend:** React (Vite)
- **Backend:** Node.js + Express
- **Database & Auth:** Firebase (Firestore + Authentication)

---

## Prerequisites
Ensure the following are installed before cloning the repository:
- [Node.js](https://nodejs.org) (v18 or higher)
- [Git](https://git-scm.com)

Verify your versions:
```bash
node --version
npm --version
```

---

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/iSirPrize/GitGud.git
cd gitgud
```

### 2. Install Dependencies

**Frontend:**
```bash
cd gitgud-client
npm install
```

**Backend:**
```bash
cd ../gitgud-server
npm install
```

### 3. Environment Variables

The project uses `.env` files for configuration. These are not committed to the repository and must be created manually. Obtain the values from a project maintainer.

**Frontend** — create `.env` inside `gitgud-client/`:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

**Backend** — create `.env` inside `gitgud-server/`:
```
PORT=3001
```

---

## Running Locally

Two terminals are required.

**Terminal 1 — Frontend:**
```bash
cd gitgud-client
npm run dev
```
Runs at `http://localhost:5173`

**Terminal 2 — Backend:**
```bash
cd gitgud-server
node index.js
```
Runs at `http://localhost:3001`

To confirm the backend is running, visit `http://localhost:3001/api/health`. A healthy response will return:
```json
{ "status": "Server is running" }
```

---

## Project Structure
```
gitgud/
├── gitgud-client/       # React frontend (Vite)
│   ├── src/
│   │   ├── firebase.js  # Firebase initialisation
│   │   └── ...
│   └── .env             # Frontend environment variables (not in repository)
│
└── gitgud-server/       # Express backend
    ├── index.js         # Server entry point
    └── .env             # Backend environment variables (not in repository)
```

---

## Troubleshooting

**Permissions error on Mac:**
```bash
sudo chown -R $(whoami) ~/.npm
```

**Port already in use:**
Update the `PORT` value in `gitgud-server/.env` and restart the server.

**Environment variables not loading:**
Ensure the `.env` file is in the correct directory and restart the development server after any changes.