const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const routes = require('./routes');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Connect to MongoDB
connectDB();

// Middleware
// CORS configuration - supports localhost, ngrok URLs, and production frontend
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [
      process.env.CLIENT_URL,
      'https://fosssilprocure.vercel.app',
      'https://www.fosssilprocure.vercel.app'
    ].filter(Boolean)
  : [
      'http://localhost:5173',
      'http://localhost:3000',
      process.env.CLIENT_URL, // Can be set to ngrok URL for development
      'https://fosssilprocure.vercel.app', // Allow production frontend in dev too
      ...(process.env.NGROK_FRONTEND_URL ? [process.env.NGROK_FRONTEND_URL] : [])
    ].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Allow ngrok URLs (for development)
    if (process.env.NODE_ENV !== 'production' && origin.includes('ngrok')) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
});












