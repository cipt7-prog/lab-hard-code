require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const querystring = require("querystring");
const SpotifyWebApi = require('spotify-web-api-node')

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;

// Exchange authorization code for access token
app.post("/api/auth", async (req, res) => {
  const { code } = req.body;
  

  try {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      querystring.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: SPOTIFY_REDIRECT_URI,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET).toString("base64"),
        },
      }
    );

    res.json({
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
    });
  } catch (error) {
    console.error("Error exchanging code for token:", error.response?.data || error.message);
    res.status(400).json({ error: "Failed to authenticate" });
  }
});

// Refresh access token
app.post("/api/refresh", async (req, res) => {
  const { refreshToken } = req.body;
  console.log(refreshToken);
  

  if (!refreshToken) {
    return res.status(400).json({ error: "Missing refresh token" });
  }

  try {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      querystring.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization:
            "Basic " +
            Buffer.from(SPOTIFY_CLIENT_ID + ":" + SPOTIFY_CLIENT_SECRET).toString("base64"),
        },
      }
    );

    res.json({
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in,
    });
  } catch (error) {
    console.error("Error refreshing token:", error.response?.data || error.message);
    res.status(400).json({ error: "Failed to refresh token" });
  }
});

// Middleware to check and refresh token
const ensureAuth = async (req, res, next) => {
  const accessToken = req.headers.authorization?.split(" ")[1];
  if (!accessToken) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  req.accessToken = accessToken;
  next();
};

// Fetch user profile
app.get("/api/me", ensureAuth, async (req, res) => {
    
  try {
    const response = await axios.get("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${req.accessToken}` },
    });
    res.json(response.data);
  } catch (error) {
    res.status(400).json({ error: "Failed to fetch user profile" });
  }
});

// Fetch top tracks
app.get("/api/top-tracks", ensureAuth, async (req, res) => {
  try {
    const response = await axios.get("https://api.spotify.com/v1/me/top/tracks?limit=10", {
      headers: { Authorization: `Bearer ${req.accessToken}` },
    });
    res.json(response.data.items);
  } catch (error) {
    res.status(400).json({ error: "Failed to fetch top tracks" });
  }
});

// Fetch recommended songs based on emotion
app.get("/api/recommendations", ensureAuth, async (req, res) => {
  const emotion = req.query.emotion;
  const genresMap = {
    happy: "pop",
    sad: "acoustic",
    angry: "rock",
    calm: "chill",
  };

  if (!genresMap[emotion]) {
    return res.status(400).json({ error: "Invalid emotion parameter" });
  }

  try {
    const response = await axios.get(
      `https://api.spotify.com/v1/recommendations?seed_genres=${genresMap[emotion]}&limit=10`,
      {
        headers: { Authorization: `Bearer ${req.accessToken}` },
      }
    );
    res.json(response.data.tracks);
  } catch (error) {
    res.status(400).json({ error: "Failed to fetch recommendations" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
