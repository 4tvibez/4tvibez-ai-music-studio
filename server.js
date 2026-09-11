import express from "express";
import { Client } from "@gradio/client";

const app = express();
const PORT = process.env.PORT || 3000;
const HF_SPACE = "ACE-Step/Ace-Step-v1.5";

app.use(express.json({ limit: "2mb" }));
app.use(express.static("."));

let aceClient = null;

async function getClient() {
  if (!aceClient) {
    aceClient = await Client.connect(HF_SPACE);
  }
  return aceClient;
}

function makeLyrics(prompt) {
  return `[Verse 1]
${prompt}

[Pre-Chorus]
Feel the rhythm rising
Every heartbeat comes alive

[Chorus]
Let the music carry us away
Tonight we shine, tonight we play
${prompt}

[Verse 2]
Move with the rhythm, follow the sound
Feel every bassline shaking the ground

[Chorus]
Let the music carry us away
Tonight we shine, tonight we play

[Outro]
Let the music carry on`;
}

app.get("/api/health", async (_req, res) => {
  try {
    const client = await getClient();
    await client.view_api();

    res.json({
      ok: true,
      provider: "ACE-Step V1.5",
      space: HF_SPACE
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      error: error.message
    });
  }
});

app.post("/api/generate", async (req, res) => {
  try {
    const {
      prompt = "",
      genre = "Afrobeats",
      mood = "Romantic",
      lyrics = "",
      key = "",
      vocalLanguage = "unknown"
    } = req.body || {};

    if (!prompt.trim()) {
      return res.status(400).json({
        error: "Please describe your song first."
      });
    }

    const finalPrompt =
      `${genre}, ${mood}, ${prompt.trim()}, ` +
      "professional commercial music production, " +
      "strong groove, memorable melody, polished mix";

    const finalLyrics =
      lyrics.trim() || makeLyrics(prompt.trim());

    const client = await getClient();

    const inputs = [
      "acestep-v15-xl-turbo",
      "custom",
      finalPrompt,
      vocalLanguage,
      finalPrompt,
      finalLyrics,
      0,
      "",
      key || "",
      vocalLanguage,
      8,
      7,
      true,
      "-1",
      null,
      -1,
      2,
      null,
      null,
      0,
      -1,
      "Fill the audio semantic mask based on the given conditions:",
      1,
      "text2music",
      false,
      0,
      1,
      3,
      "ode",
      "",
      "mp3",
      0.85,
      true,
      2,
      0,
      0.9,
      "NO USER INPUT",
      true,
      true,
      true,
      null,
      false,
      true,
      false,
      false,
      0.5,
      "8",
      null,
      false
    ];
    
const job = client.submit(
  "/generation_wrapper",
  inputs
);

    // Create our own ID for the browser.
    // The job itself remains stored on this server.
    const id =
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

    global.musicJobs = global.musicJobs || new Map();

    global.musicJobs.set(id, job);

    res.json({
      ok: true,
      predictionId: id,
      status: "starting",
      provider: "ACE-Step V1.5"
    });

  } catch (error) {
    console.error(error);

    res.status(503).json({
      error:
        error?.message ||
        "ACE-Step could not start the generation."
    });
  }
});

app.get("/api/generate/:id", async (req, res) => {
  try {
    global.musicJobs = global.musicJobs || new Map();

    const job = global.musicJobs.get(req.params.id);

    if (!job) {
      return res.status(404).json({
        error: "Generation job not found."
      });
    }

    const status = await job.status();

    if (status === "FINISHED") {
      const result = await job.result();

      global.musicJobs.delete(req.params.id);

      res.json({
        ok: true,
        status: "succeeded",
        result
      });

      return;
    }

    if (
      status === "FAILED" ||
      status === "CANCELLED"
    ) {
      global.musicJobs.delete(req.params.id);

      res.json({
        ok: false,
        status: "failed",
        error: `ACE-Step generation ${status.toLowerCase()}.`
      });

      return;
    }

    res.json({
      ok: false,
      status: "processing"
    });

  } catch (error) {
    console.error(error);

    res.status(503).json({
      error:
        error?.message ||
        "Could not check generation status."
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `4TVIBEZ AI Music Studio running on port ${PORT}`
  );
});
