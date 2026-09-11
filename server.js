import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;

// ACE-Step API server.
// Set this in Railway if your ACE-Step server is hosted somewhere else.
const ACE_STEP_URL =
  process.env.ACE_STEP_URL || "http://127.0.0.1:8001";

const ACE_STEP_API_KEY =
  process.env.ACE_STEP_API_KEY || "";

app.use(express.json({ limit: "2mb" }));

// Your index.html is in the ROOT of the GitHub repository.
app.use(express.static(process.cwd()));

// -----------------------------
// Helpers
// -----------------------------

async function aceFetch(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (ACE_STEP_API_KEY) {
    headers.Authorization = `Bearer ${ACE_STEP_API_KEY}`;
    headers["X-API-Key"] = ACE_STEP_API_KEY;
  }

  const response = await fetch(
    `${ACE_STEP_URL}${endpoint}`,
    {
      ...options,
      headers
    }
  );

  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = {
      raw: text
    };
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      data?.detail ||
      `ACE-Step HTTP ${response.status}`
    );
  }

  return data;
}

function unwrap(data) {
  if (
    data &&
    typeof data === "object" &&
    "data" in data
  ) {
    return data.data;
  }

  return data;
}

function findAudioPath(value) {
  if (!value) return null;

  if (typeof value === "string") {
    if (
      value.includes("/v1/audio") ||
      value.endsWith(".mp3") ||
      value.endsWith(".wav") ||
      value.endsWith(".flac") ||
      value.endsWith(".opus") ||
      value.endsWith(".aac")
    ) {
      return value;
    }

    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = findAudioPath(item);

      if (result) return result;
    }

    return null;
  }

  if (typeof value === "object") {
    const keys = [
      "file",
      "audio",
      "audio_path",
      "path",
      "url",
      "result"
    ];

    for (const key of keys) {
      if (key in value) {
        const result = findAudioPath(value[key]);

        if (result) return result;
      }
    }

    for (const key of Object.keys(value)) {
      const result = findAudioPath(value[key]);

      if (result) return result;
    }
  }

  return null;
}

function makeAudioUrl(pathOrUrl) {
  if (!pathOrUrl) return null;

  if (
    pathOrUrl.startsWith("http://") ||
    pathOrUrl.startsWith("https://")
  ) {
    return pathOrUrl;
  }

  if (pathOrUrl.startsWith("/")) {
    return `${ACE_STEP_URL}${pathOrUrl}`;
  }

  return `${ACE_STEP_URL}/${pathOrUrl}`;
}

// -----------------------------
// Health
// -----------------------------

app.get("/api/health", async (req, res) => {
  try {
    const result = await aceFetch("/health", {
      method: "GET"
    });

    res.json({
      ok: true,
      provider: "ACE-Step 1.5",
      aceStep: result
    });

  } catch (error) {
    console.error("ACE-Step health error:", error);

    res.status(503).json({
      ok: false,
      provider: "ACE-Step 1.5",
      error: error.message,
      aceStepUrl: ACE_STEP_URL
    });
  }
});

// -----------------------------
// Generate
// -----------------------------

app.post("/api/generate", async (req, res) => {
  try {
    const {
      prompt,
      lyrics,
      bpm,
      key,
      key_scale,
      vocalLanguage,
      vocal_language,
      duration,
      audio_duration,
      instrumental
    } = req.body || {};

    const finalPrompt =
      String(prompt || "").trim() ||
      "A beautiful modern Afrobeats song with warm guitar, deep bass, rhythmic drums, catchy melody and emotional vocals.";

    const finalLyrics =
      String(lyrics || "").trim() ||
      `[Verse 1]
Walking through the night,
Thinking about your love,
Every little moment,
Feels like heaven above.

[Chorus]
I will keep on loving you,
No matter where you go,
You are the rhythm in my heart,
You are the only one I know.

[Verse 2]
Every sunrise brings your name,
Every heartbeat calls for you,
Through the highs and through the lows,
My love will stay forever true.

[Chorus]
I will keep on loving you,
No matter where you go,
You are the rhythm in my heart,
You are the only one I know.`;

    const finalDuration =
      Number(
        audio_duration ??
        duration ??
        30
      ) || 30;

    const finalBpm =
      bpm === undefined ||
      bpm === null ||
      bpm === ""
        ? null
        : Number(bpm);

    const finalKey =
      String(
        key_scale ??
        key ??
        ""
      ).trim();

    const finalLanguage =
      String(
        vocal_language ??
        vocalLanguage ??
        "unknown"
      ).trim() || "unknown";

    const isInstrumental =
      Boolean(instrumental);

    const payload = {
      prompt: finalPrompt,

      lyrics:
        isInstrumental
          ? ""
          : finalLyrics,

      thinking: false,

      audio_duration:
        Math.min(
          Math.max(finalDuration, 10),
          600
        ),

      bpm: finalBpm,

      key_scale:
        finalKey || null,

      vocal_language:
        finalLanguage,

      audio_format: "mp3",

      task_type: "text2music",

      inference_steps: 8,

      guidance_scale: 7,

      use_adg: false,

      cfg_interval_start: 0,

      cfg_interval_end: 1,

      infer_method: "ode",

      shift: 3,

      lm_temperature: 0.85,

      lm_cfg_scale: 2.5,

      lm_top_k: 50,

      lm_top_p: 0.9,

      lm_negative_prompt:
        "NO USER INPUT",

      use_cot_caption: true,

      use_cot_language: true,

      is_format_caption: false,

      allow_lm_batch: true
    };

    console.log(
      "Sending generation request to ACE-Step..."
    );

    const result = await aceFetch(
      "/release_task",
      {
        method: "POST",
        body: JSON.stringify(payload)
      }
    );

    const data = unwrap(result);

    const taskId =
      data?.task_id ||
      data?.id ||
      data?.taskId;

    if (!taskId) {
      console.error(
        "ACE-Step returned:",
        JSON.stringify(result)
      );

      return res.status(502).json({
        ok: false,
        error:
          "ACE-Step did not return a task ID.",
        response: result
      });
    }

    res.json({
      ok: true,
      id: taskId,
      status: "generating"
    });

  } catch (error) {
    console.error(
      "Generation start error:",
      error
    );

    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// -----------------------------
// Poll generation
// -----------------------------

app.get(
  "/api/generate/:id",
  async (req, res) => {
    try {
      const taskId =
        req.params.id;

      const result =
        await aceFetch(
          "/query_result",
          {
            method: "POST",
            body: JSON.stringify({
              task_id: taskId
            })
          }
        );

      const data = unwrap(result);

      let parsed = data;

      // Some ACE-Step versions return
      // the result as a JSON string.
      if (typeof data === "string") {
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = {
            raw: data
          };
        }
      }

      const status =
        parsed?.status ??
        data?.status ??
        "generating";

      if (
        status === 2 ||
        status === "failed" ||
        status === "error"
      ) {
        return res.json({
          ok: false,
          status: "error",
          error:
            parsed?.message ||
            parsed?.error ||
            "ACE-Step generation failed."
        });
      }

      const audioPath =
        findAudioPath(parsed);

      if (audioPath) {
        return res.json({
          ok: true,
          status: "complete",
          audioUrl:
            makeAudioUrl(audioPath)
        });
      }

      if (
        status === 1 ||
        status === "success" ||
        status === "complete" ||
        status === "completed"
      ) {
        return res.json({
          ok: true,
          status: "complete",
          audioUrl: null,
          result: parsed
        });
      }

      res.json({
        ok: true,
        status: "generating"
      });

    } catch (error) {
      console.error(
        "Generation polling error:",
        error
      );

      res.status(500).json({
        ok: false,
        status: "error",
        error: error.message
      });
    }
  }
);

// -----------------------------
// Root fallback
// -----------------------------

app.get("*", (req, res) => {
  res.sendFile(
    `${process.cwd()}/index.html`
  );
});

// -----------------------------
// Start
// -----------------------------

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `4TVIBEZ AI Music Studio running on port ${PORT}`
    );

    console.log(
      `ACE-Step API: ${ACE_STEP_URL}`
    );
  }
);
