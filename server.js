import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;
const ACE_STEP_URL = (process.env.ACE_STEP_URL || "http://127.0.0.1:8001").replace(/\/$/, "");
const ACE_STEP_API_KEY = process.env.ACE_STEP_API_KEY || "";

app.use(express.json({ limit: "1mb" }));
app.use(express.static("."));

function headers() {
  const h = { "Content-Type": "application/json" };
  if (ACE_STEP_API_KEY) h.Authorization = `Bearer ${ACE_STEP_API_KEY}`;
  return h;
}

function makeLyrics(prompt, genre, mood) {
  return `[Intro]
${genre} atmosphere, ${mood} mood

[Verse 1]
${prompt}

[Pre Chorus]
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
${prompt}

[Outro]
Let the music carry on`;
}

function durationSeconds(value) {
  const match = String(value || "").match(/\d+/);
  const minutes = match ? Number(match[0]) : 2;
  return Math.min(300, Math.max(30, minutes * 60));
}

app.get("/api/health", async (_req, res) => {
  try {
    const r = await fetch(`${ACE_STEP_URL}/health`);
    const data = await r.json().catch(() => ({}));

    res.status(r.ok ? 200 : 503).json({
      ok: r.ok,
      provider: "ACE-Step 1.5",
      engine: data
    });
  } catch {
    res.status(503).json({
      ok: false,
      provider: "ACE-Step 1.5",
      error: "ACE-Step engine is not reachable."
    });
  }
});

app.post("/api/generate", async (req, res) => {
  try {
    const {
      prompt,
      genre = "Afrobeats",
      mood = "Romantic",
      duration = "2-3 minutes",
      lyrics = "",
      bpm,
      key = "",
      vocalLanguage = "en"
    } = req.body || {};

    if (!prompt?.trim()) {
      return res.status(400).json({
        error: "Describe your song first."
      });
    }

    const musicPrompt = [
      genre,
      mood,
      prompt.trim(),
      "professional commercial music production",
      "strong groove, memorable melody, clean arrangement, polished mix",
      genre.toLowerCase().includes("afrobeats")
        ? "Afrobeats percussion, melodic guitar, warm bass, syncopated groove"
        : "",
      genre.toLowerCase().includes("amapiano")
        ? "Amapiano log drums, piano chords, shakers, deep bass groove"
        : ""
    ].filter(Boolean).join(", ");

    const payload = {
      prompt: musicPrompt.slice(0, 2000),
      lyrics: (
        lyrics?.trim() ||
        makeLyrics(prompt, genre, mood)
      ).slice(0, 5000),

      thinking: true,
      sample_mode: false,
      audio_duration: durationSeconds(duration),
      audio_format: "mp3",
      vocal_language: vocalLanguage,
      task_type: "text2music",
      inference_steps: 8,
      batch_size: 1,
      use_random_seed: true
    };

    if (bpm) {
      payload.bpm = Math.max(
        30,
        Math.min(300, Number(bpm))
      );
    }

    if (key) {
      payload.key_scale = key;
    }

    const response = await fetch(
      `${ACE_STEP_URL}/release_task`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data?.error ||
          "ACE-Step rejected the generation request."
      });
    }

    const taskId =
      data?.data?.task_id ||
      data?.task_id;

    if (!taskId) {
      return res.status(502).json({
        error: "ACE-Step did not return a task ID."
      });
    }

    res.json({
      ok: true,
      predictionId: taskId,
      status: "starting",
      provider: "ACE-Step 1.5"
    });

  } catch (error) {
    console.error(error);

    res.status(503).json({
      error:
        "ACE-Step could not be reached. Check the ACE_STEP_URL."
    });
  }
});

app.get("/api/generate/:id", async (req, res) => {
  try {
    const response = await fetch(
      `${ACE_STEP_URL}/query_result`,
      {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          task_id_list: [req.params.id]
        })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Could not check generation status."
      });
    }

    const results =
      data?.data ||
      data?.results ||
      data;

    const item =
      Array.isArray(results)
        ? results[0]
        : null;

    if (!item) {
      return res.json({
        ok: false,
        status: "processing",
        audio: null
      });
    }

    if (item.status === 2) {
      return res.json({
        ok: false,
        status: "failed",
        audio: null,
        error: item.error || "Generation failed."
      });
    }

    if (item.status !== 1) {
      return res.json({
        ok: false,
        status: "processing",
        audio: null
      });
    }

    let result = item.result;

    if (typeof result === "string") {
      try {
        result = JSON.parse(result);
      } catch {
        result = [];
      }
    }

    const first =
      Array.isArray(result)
        ? result[0]
        : result;

    let audio =
      first?.file ||
      first?.audio ||
      first?.url ||
      null;

    if (audio && audio.startsWith("/")) {
      audio = `${ACE_STEP_URL}${audio}`;
    }

    res.json({
      ok: Boolean(audio),
      status: "succeeded",
      audio,
      meta: first?.metas || null
    });

  } catch (error) {
    console.error(error);

    res.status(503).json({
      error:
        "Could not check ACE-Step generation status."
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `4TVIBEZ AI Music Studio running on port ${PORT}`
  );
});
