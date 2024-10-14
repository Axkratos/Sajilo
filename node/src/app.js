import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";

import exerciseRoutes from "./routes/exerciseRoute.js";
import userRoutes from "./routes/userRoute.js";
import authRoutes from "./routes/authRoute.js";


// Initialize Express app
const app = express();



// __dirname replacement in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS configuration for Express
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",  // Default to your local frontend
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE","PATCH", "OPTIONS"],  // Add allowed HTTP methods
  })
);

// JSON Parser configuration
app.use(
  express.json({
    limit: "16kb",
  })
);

// URL encoding configuration
app.use(
  express.urlencoded({
    extended: true,
    limit: "16kb",
  })
);

// Setting up cookie parser
app.use(cookieParser());

// Serve static files from the 'public' directory
app.use("/public", express.static(path.join(__dirname, "../public")));

// Importing Routes

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/exercises", exerciseRoutes);


// Root route
app.get("/", (req, res) => {
  res.status(200).json({ message: "This contains API for sajilorehab" });
});


export { app };
