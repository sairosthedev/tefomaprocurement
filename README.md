# FosssilProcure 🦴

MERN Stack Monorepo - MongoDB, Express, React, Node.js

## Structure

```
fosssilProcure/
├── api/                 # Express backend (port 3001)
│   └── src/
│       ├── server.js    # Entry point
│       ├── config/      # Database config
│       └── routes/      # API routes
├── client/              # React Vite frontend (port 5173)
│   └── src/
│       ├── main.jsx     # Entry point
│       └── App.jsx      # Main component
└── package.json         # Monorepo workspaces config
```

## Quick Start

### Prerequisites
- Node.js >= 18
- MongoDB (local or Atlas)

### Installation

```bash
# Install all dependencies (runs at root, installs both api and client)
npm install
```

### Environment Setup

Create a `.env` file in the `api/` folder:

```env
MONGODB_URI=mongodb://localhost:27017/fosssil-procure
PORT=3001
NODE_ENV=development
```

### Running Development Servers

```bash
# Run both API and Client simultaneously
npm run dev
```

This will start:
- **API**: http://localhost:3001
- **Client**: http://localhost:5173

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Run both servers in parallel |
| `npm run dev:api` | Run only the API server |
| `npm run dev:client` | Run only the React client |
| `npm run build` | Build the client for production |
| `npm start` | Start the API in production mode |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api` | API welcome message |
| GET | `/health` | Health check |

## Tech Stack

- **Frontend**: React 18, Vite 5
- **Backend**: Express 4, Node.js
- **Database**: MongoDB with Mongoose
- **Monorepo**: npm workspaces + concurrently

