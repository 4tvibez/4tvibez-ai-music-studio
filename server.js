const express = require("express");
const path = require("path");
const { Client } = require("@gradio/client");

const app = express();
const PORT = process.env.PORT || 3000;

// Official ACE-Step Hugging Face Space
const HF_SPACE = "ACE-Step/Ace-Step-v1.5";

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

const jobs = new Map();

let clientPromise = null;

async function getClient() {
  if (!clientPromise) {
    clientPromise = Client.connect(HF_SPACE, {
      events: ["status", "data"]
    });
  }

  return clientPromise;
}

// Find an audio URL anywhere inside an ACE-Step response.
function findAudioUrl(value) {
  if (!value) return null;

  if (typeof value === "string") {
    if (
      value.startsWith("http://") ||
      value.startsWith("https://")
    ) {
      return value;
    }

    if (
      value.startsWith("/file=") ||
      value.startsWith("/gradio_api/file=")
    ) {
      return value;
    }

    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAudioUrl(item);
      if (found) return found;
    }
    return null;
  }

  if (typeof value === "object") {
    const preferredKeys = [
      "url",
      "audio",
      "file",
      "path",
      "value",
      "data"
    ];

    for (const key of preferredKeys) {
      if (key in value) {
        const found = findAudioUrl(value[key]);
        if (found) return found;
      }
    }

    for (const key of Object.keys(value)) {
      const found = findAudioUrl(value[key]);
      if (found) return found;
    }
  }

  return null;
}

function normaliseAudioUrl(url) {
  if (!url) return null;

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("/")) {
    return `https://ace-step-ace-step-v1-5.hf.space${url}`;
  }

  return url;
}

// Health check
app.get("/api/health", async (req, res) => {
  try {
    const client = await getClient();

    await client.view_api();

    res.json({
      ok: true,
      provider: "ACE-Step 1.5",
      space: HF_SPACE
    });
  } catch (error) {
    console.error("Health error:", error);

    res.status(503).json({
      ok: false,
      provider: "ACE-Step 1.5",
      error: error.message
    });
  }
});

// Start generation
app.post("/api/generate", async (req, res) => {
  try {
    const {
      prompt,
      lyrics,
      bpm,
      key,
      vocalLanguage,
      duration
    } = req.body || {};

    const finalPrompt =
      String(prompt || "").trim() ||
      "An uplifting Afrobeats song with warm guitars, deep bass, rhythmic drums and beautiful melodic vocals.";

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

    const finalDuration = Number(duration) || 30;

    const finalBpm =
      bpm === undefined ||
      bpm === null ||
      bpm === ""
        ? null
        : Number(bpm);

    const finalKey =
      key && String(key).trim()
        ? String(key).trim()
        : null;

    const finalVocalLanguage =
      vocalLanguage && String(vocalLanguage).trim()
        ? String(vocalLanguage).trim()
        : "unknown";

    const client = await getClient();

    /*
     * ACE-Step generation_wrapper positional order.
     *
     * IMPORTANT:
     * - generation mode must be "simple" for this Space API
     * - track_name must be null in Simple mode
     * - do NOT put "4TVIBEZ Original" into track_name
     */

    const inputs = [

      // 1 selected model
      "acestep-v15-xl-turbo",

      // 2 generation mode
      "simple",

      // 3 simple query
      finalPrompt,

      // 4 simple vocal language
      finalVocalLanguage,

      // 5 captions
      finalPrompt,

      // 6 lyrics
      finalLyrics,

      // 7 BPM
      finalBpm,

      // 8 key / scale
      finalKey,

      // 9 time signature
      "4/4",

      // 10 vocal language
      finalVocalLanguage,

      // 11 inference steps
      8,

      // 12 guidance scale
      7,

      // 13 random seed checkbox
      false,

      // 14 seed
      -1,

      // 15 reference audio
      null,

      // 16 audio duration
      finalDuration,

      // 17 batch size
      1,

      // 18 source audio
      null,

      // 19 text2music audio code string
      "",

      // 20 repainting start
      0,

      // 21 repainting end
      -1,

      // 22 instruction
      "Fill the audio semantic mask based on the given conditions:",

      // 23 audio cover strength
      1,

      // 24 task type
      "text2music",

      // 25 use ADG
      false,

      // 26 CFG interval start
      0,

      // 27 CFG interval end
      1,

      // 28 shift
      3,

      // 29 inference method
      "ode",

      // 30 custom timesteps
      null,

      // 31 audio format
      "mp3",

      // 32 LM temperature
      0.85,

      // 33 thinking
      false,

      // 34 LM CFG scale
      2.5,

      // 35 LM top K
      50,

      // 36 LM top P
      0.9,

      // 37 LM negative prompt
      "NO USER INPUT",

      // 38 use COT metas
      true,

      // 39 use COT caption
      true,

      // 40 use COT language
      true,

      // 41 format caption state
      false,

      // 42 constrained decoding debug
      false,

      // 43 allow LM batch
      true,

      // 44 auto score
      false,

      // 45 auto LRC
      true,

      // 46 score scale
      1,

      // 47 LM batch chunk size
      1,

      // 48 TRACK NAME
      // MUST be null for Simple mode.
      null,

      // 49 complete track classes
      [],

      // 50 autogen checkbox
      false,

      // 51 current batch index
      0,

      // 52 total batches
      1,

      // 53 batch queue
      [],

      // 54 generation params state
      {}
    ];

    console.log("Submitting ACE-Step generation...");

    const job = client.submit(
      "/generation_wrapper",
      inputs
    );

    const jobId =
      Date.now().toString(36) +
      Math.random().toString(36).slice(2);

    jobs.set(jobId, {
      status: "generating",
      audioUrl: null,
      error: null,
      createdAt: Date.now()
    });

    // Process ACE-Step events in background.
    (async () => {
      try {
        for await (const message of job) {

          console.log(
            "ACE-Step message:",
            JSON.stringify(message).slice(0, 2000)
          );

          const stored = jobs.get(jobId);

          if (!stored) continue;

          // Error message
          if (message && message.type === "error") {
            stored.status = "error";
            stored.error =
              message.message ||
              message.error ||
              "ACE-Step generation failed.";

            jobs.set(jobId, stored);
            continue;
          }

          // Status update
          if (message && message.type === "status") {

            const status =
              message.status ||
              message.stage ||
              "";

            if (
              status === "complete" ||
              status === "completed"
            ) {
              stored.status = "complete";
            } else if (status === "error") {
              stored.status = "error";
              stored.error =
                message.message ||
                "ACE-Step generation failed.";
            } else {
              stored.status = "generating";
            }

            jobs.set(jobId, stored);
          }

          // Data result
          if (message && message.type === "data") {

            const possibleAudio =
              findAudioUrl(message.data);

            if (possibleAudio) {
              stored.audioUrl =
                normaliseAudioUrl(possibleAudio);

              stored.status = "complete";

              jobs.set(jobId, stored);

              console.log(
                "Audio found:",
                stored.audioUrl
              );
            }
          }
        }

        const stored = jobs.get(jobId);

        if (stored && !stored.audioUrl && stored.status !== "error") {
          stored.status = "complete";
          jobs.set(jobId, stored);
        }

      } catch (error) {

        console.error(
          "ACE-Step generation error:",
          error
        );

        const stored = jobs.get(jobId);

        if (stored) {
          stored.status = "error";
          stored.error =
            error.message ||
            "Generation failed.";

          jobs.set(jobId, stored);
        }
      }
    })();

    res.json({
      ok: true,
      id: jobId,
      status: "generating"
    });

  } catch (error) {

    console.error(
      "Generate request error:",
      error
    );

    res.status(500).json({
      ok: false,
      error:
        error.message ||
        "Unable to start generation."
    });
  }
});

// Poll generation
app.get("/api/generate/:id", (req, res) => {

  const job = jobs.get(req.params.id);

  if (!job) {
    return res.status(404).json({
      ok: false,
      error: "Generation job not found."
    });
  }

  res.json({
    ok: true,
    status: job.status,
    audioUrl: job.audioUrl,
    error: job.error
  });
});

// Cancel / remove job
app.delete("/api/generate/:id", (req, res) => {

  jobs.delete(req.params.id);

  res.json({
    ok: true
  });
});

// Clean old jobs every 30 minutes
setInterval(() => {

  const cutoff =
    Date.now() - 60 * 60 * 1000;

  for (const [id, job] of jobs.entries()) {

    if (job.createdAt < cutoff) {
      jobs.delete(id);
    }
  }

}, 30 * 60 * 1000);

// Start server
app.listen(PORT, "0.0.0.0", () => {

  console.log(
    `4TVIBEZ AI Music Studio running on port ${PORT}`
  );

});
