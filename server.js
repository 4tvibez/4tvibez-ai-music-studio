import express from "express";
import { Client } from "@gradio/client";

const app = express();
const PORT = process.env.PORT || 3000;

const HF_SPACE = "ACE-Step/Ace-Step-v1.5";

app.use(express.json({ limit: "4mb" }));
app.use(express.static("."));

global.musicJobs = global.musicJobs || new Map();

let aceClient = null;

/* =========================================================
   CONNECT TO ACE-STEP
========================================================= */

async function getClient() {
  if (!aceClient) {
    console.log("Connecting to ACE-Step...");

    aceClient = await Client.connect(HF_SPACE, {
      events: ["status", "data"]
    });

    console.log("Connected to ACE-Step.");
  }

  return aceClient;
}

/* =========================================================
   FALLBACK LYRICS
========================================================= */

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
Move with the rhythm
Follow the sound
Feel every bassline
Shaking the ground

[Chorus]
Let the music carry us away
Tonight we shine, tonight we play

[Bridge]
Let the rhythm take control
Let the music fill your soul

[Outro]
Let the music carry on`;
}

/* =========================================================
   FIND AUDIO URL
========================================================= */

function findAudioUrl(value, seen = new Set()) {
  if (value == null) return null;

  if (typeof value === "object") {
    if (seen.has(value)) return null;
    seen.add(value);
  }

  if (typeof value === "string") {
    const text = value.trim();

    if (
      text.startsWith("http://") ||
      text.startsWith("https://")
    ) {
      return text;
    }

    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAudioUrl(item, seen);

      if (found) return found;
    }

    return null;
  }

  if (typeof value === "object") {

    const keys = [
      "url",
      "audio",
      "file",
      "path",
      "value",
      "data",
      "name",
      "orig_name"
    ];

    for (const key of keys) {

      if (value[key] != null) {

        const found =
          findAudioUrl(value[key], seen);

        if (found) return found;
      }
    }

    for (const [key, child] of Object.entries(value)) {

      if (keys.includes(key)) continue;

      const found =
        findAudioUrl(child, seen);

      if (found) return found;
    }
  }

  return null;
}

/* =========================================================
   HEALTH
========================================================= */

app.get("/api/health", async (_req, res) => {

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

    aceClient = null;

    res.status(503).json({
      ok: false,
      error:
        error?.message ||
        "ACE-Step is unavailable."
    });
  }
});

/* =========================================================
   GENERATE MUSIC
========================================================= */

app.post("/api/generate", async (req, res) => {

  try {

    const {
      prompt = "",
      genre = "Afrobeats",
      mood = "Romantic",
      lyrics = "",
      key = "",
      vocalLanguage = "en"
    } = req.body || {};

    if (!String(prompt).trim()) {

      return res.status(400).json({
        ok: false,
        error: "Please describe your song first."
      });
    }

    const finalPrompt =
      `${genre}, ${mood}, ${String(prompt).trim()}, ` +
      "professional commercial music production, " +
      "strong groove, memorable melody, polished mix";

    const finalLyrics =
      String(lyrics).trim() ||
      makeLyrics(String(prompt).trim());

    console.log("--------------------------------");
    console.log("4TVIBEZ MUSIC GENERATION");
    console.log("--------------------------------");
    console.log("Prompt:", finalPrompt);
    console.log("Lyrics length:", finalLyrics.length);

    const client = await getClient();

    /*
     * IMPORTANT
     *
     * ACE-Step currently expects:
     *
     * First 4 inputs:
     * 1 selected_model
     * 2 generation_mode
     * 3 simple_query_input
     * 4 simple_vocal_language
     *
     * Then the generation parameters.
     */

    const inputs = [

      /* =====================================================
         SIMPLE MODE INPUTS
      ===================================================== */

      // 1 selected model
      "acestep-v15-xl-turbo",

      // 2 generation mode
      "simple",

      // 3 simple query
      finalPrompt,

      // 4 simple vocal language
      vocalLanguage,

      /* =====================================================
         GENERATION PARAMETERS
      ===================================================== */

      // 5 captions
      finalPrompt,

      // 6 lyrics
      finalLyrics,

      // 7 BPM
      120,

      // 8 key scale
      key || "C",

      // 9 time signature
      "4/4",

      // 10 vocal language
      vocalLanguage,

      // 11 inference steps
      8,

      // 12 guidance scale
      7.0,

      // 13 random seed checkbox
      true,

      // 14 seed
      -1,

      // 15 reference audio
      null,

      // 16 audio duration
      60,

      // 17 batch size
      1,

      // 18 source audio
      null,

      // 19 audio code string
      "",

      // 20 repainting start
      0.0,

      // 21 repainting end
      0.0,

      // 22 instruction
      "",

      // 23 audio cover strength
      1.0,

      // 24 task type
      "text2music",

      // 25 use ADG
      false,

      // 26 CFG interval start
      0.0,

      // 27 CFG interval end
      1.0,

      // 28 shift
      1.0,

      // 29 inference method
      "ode",

      // 30 custom timesteps
      null,

      // 31 audio format
      "mp3",

      // 32 LM temperature
      0.85,

      // 33 thinking
      true,

      // 34 LM CFG scale
      2.0,

      // 35 LM top K
      0,

      // 36 LM top P
      0.9,

      // 37 LM negative prompt
      "",

      // 38 use CoT metas
      true,

      // 39 use CoT caption
      true,

      // 40 use CoT language
      true,

      // 41 format caption state
      false,

      // 42 constrained decoding debug
      false,

      // 43 allow LM batch
      false,

      // 44 auto score
      false,

      // 45 auto LRC
      false,

      // 46 score scale
      0.5,

      // 47 LM batch chunk size
      8,

      // 48 track name
      "4TVIBEZ Original",

      // 49 complete track classes
      "",

      // 50 autogen checkbox
      false,

      // 51 current batch index
      0,

      // 52 total batches
      1,

      // 53 batch queue
      null,

      // 54 generation params state
      null
    ];

    console.log(
      "Submitting correctly ordered ACE-Step request..."
    );

    const job = client.submit(
      "/generation_wrapper",
      inputs
    );

    const id =
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

    const state = {
      status: "queued",
      result: null,
      audioUrl: null,
      error: null,
      lastEvent: null,
      startedAt: Date.now()
    };

    global.musicJobs.set(id, {
      job,
      state
    });

    console.log("Job ID:", id);

    /* =====================================================
       READ GRADIO EVENT STREAM
    ===================================================== */

    (async () => {

      try {

        for await (const message of job) {

          console.log(
            "ACE-Step event:",
            JSON.stringify(message)
          );

          state.lastEvent = message;

          /* -------------------------------------------------
             STATUS
          ------------------------------------------------- */

          if (message?.type === "status") {

            const status =
              message?.status ||
              message?.stage ||
              "";

            console.log(
              "ACE-Step status:",
              status
            );

            if (
              status === "pending" ||
              status === "queued"
            ) {

              state.status = "queued";
            }

            else if (
              status === "generating" ||
              status === "processing"
            ) {

              state.status = "generating";
            }

            else if (
              status === "error" ||
              message?.success === false
            ) {

              state.status = "failed";

              state.error =
                message?.message ||
                message?.error ||
                "ACE-Step reported an error.";

              break;
            }
          }

          /* -------------------------------------------------
             DATA
          ------------------------------------------------- */

          if (message?.type === "data") {

            state.result =
              message.data;

            const audioUrl =
              findAudioUrl(message.data);

            if (audioUrl) {

              state.audioUrl =
                audioUrl;

              state.status =
                "succeeded";

              console.log(
                "AUDIO URL FOUND:",
                audioUrl
              );
            }
          }
        }

        /* -------------------------------------------------
           STREAM FINISHED
        ------------------------------------------------- */

        if (state.audioUrl) {

          state.status =
            "succeeded";

        } else if (
          state.status !== "failed"
        ) {

          state.status =
            "failed";

          state.error =
            "ACE-Step finished but did not return an audio URL.";
        }

      } catch (error) {

        console.error(
          "ACE-Step stream error:",
          error
        );

        state.status =
          "failed";

        state.error =
          error?.message ||
          "ACE-Step generation failed.";
      }

    })();

    return res.json({
      ok: true,
      predictionId: id,
      status: "starting",
      provider: "ACE-Step 1.5"
    });

  } catch (error) {

    console.error(
      "Generation start error:",
      error
    );

    aceClient = null;

    return res.status(503).json({
      ok: false,
      error:
        error?.message ||
        "Could not start ACE-Step generation."
    });
  }
});

/* =========================================================
   CHECK GENERATION
========================================================= */

app.get("/api/generate/:id", async (req, res) => {

  try {

    const stored =
      global.musicJobs.get(
        req.params.id
      );

    if (!stored) {

      return res.status(404).json({
        ok: false,
        status: "not_found",
        error: "Generation job not found."
      });
    }

    const { state } =
      stored;

    /* SUCCESS */

    if (
      state.status === "succeeded"
    ) {

      const response = {
        ok: true,
        status: "succeeded",
        audioUrl: state.audioUrl,
        result: state.result
      };

      global.musicJobs.delete(
        req.params.id
      );

      return res.json(response);
    }

    /* FAILURE */

    if (
      state.status === "failed"
    ) {

      const error =
        state.error ||
        "ACE-Step generation failed.";

      global.musicJobs.delete(
        req.params.id
      );

      return res.status(500).json({
        ok: false,
        status: "failed",
        error
      });
    }

    /* PROCESSING */

    return res.json({
      ok: false,
      status:
        state.status ||
        "processing",
      message:
        state.status === "queued"
          ? "Your song is waiting for the AI GPU..."
          : "ACE-Step is generating your song..."
    });

  } catch (error) {

    console.error(
      "Generation status error:",
      error
    );

    return res.status(503).json({
      ok: false,
      error:
        error?.message ||
        "Could not check generation status."
    });
  }
});

/* =========================================================
   CANCEL JOB
========================================================= */

app.delete("/api/generate/:id", async (req, res) => {

  try {

    const stored =
      global.musicJobs.get(
        req.params.id
      );

    if (!stored) {

      return res.status(404).json({
        ok: false,
        error: "Generation job not found."
      });
    }

    try {

      if (
        stored.job &&
        typeof stored.job.cancel === "function"
      ) {

        stored.job.cancel();
      }

    } catch (error) {

      console.warn(
        "Cancel warning:",
        error
      );
    }

    global.musicJobs.delete(
      req.params.id
    );

    return res.json({
      ok: true,
      status: "cancelled"
    });

  } catch (error) {

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "Could not cancel job."
    });
  }
});

/* =========================================================
   REMOVE OLD JOBS
========================================================= */

setInterval(() => {

  const now =
    Date.now();

  for (
    const [id, stored]
    of global.musicJobs.entries()
  ) {

    const age =
      now -
      (stored.state?.startedAt || now);

    if (
      age >
      20 * 60 * 1000
    ) {

      console.log(
        "Removing expired job:",
        id
      );

      try {

        if (
          stored.job &&
          typeof stored.job.cancel === "function"
        ) {

          stored.job.cancel();
        }

      } catch {}

      global.musicJobs.delete(id);
    }
  }

}, 60 * 1000);

/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, () => {

  console.log("--------------------------------");
  console.log("4TVIBEZ AI MUSIC STUDIO");
  console.log("--------------------------------");
  console.log(
    `Server running on port ${PORT}`
  );
  console.log(
    `ACE-Step: ${HF_SPACE}`
  );
  console.log("--------------------------------");

});
