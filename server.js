import express from "express";
import { Client } from "@gradio/client";

const app = express();
const PORT = process.env.PORT || 3000;

// Official ACE-Step 1.5 Hugging Face Space
const HF_SPACE = "ACE-Step/Ace-Step-v1.5";

app.use(express.json({ limit: "4mb" }));

// Serve the website
app.use(express.static("."));

// Store jobs in memory
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
   FIND AUDIO URL INSIDE ANY GRADIO RESPONSE
========================================================= */

function findAudioUrl(value, seen = new Set()) {
  if (value == null) return null;

  // Prevent circular objects
  if (typeof value === "object") {
    if (seen.has(value)) return null;
    seen.add(value);
  }

  // Direct string
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

  // Arrays
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAudioUrl(item, seen);
      if (found) return found;
    }

    return null;
  }

  // Objects
  if (typeof value === "object") {

    // Common Gradio audio/file properties
    const possibleKeys = [
      "url",
      "audio",
      "file",
      "path",
      "value",
      "data",
      "name",
      "orig_name"
    ];

    for (const key of possibleKeys) {
      if (value[key] != null) {
        const found = findAudioUrl(value[key], seen);

        if (found) {
          return found;
        }
      }
    }

    // Search all remaining properties
    for (const [key, child] of Object.entries(value)) {

      if (possibleKeys.includes(key)) {
        continue;
      }

      const found = findAudioUrl(child, seen);

      if (found) {
        return found;
      }
    }
  }

  return null;
}

/* =========================================================
   HEALTH CHECK
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

    console.error("Health check failed:", error);

    // Force reconnect next time
    aceClient = null;

    res.status(503).json({
      ok: false,
      provider: "ACE-Step 1.5",
      error:
        error?.message ||
        "ACE-Step is currently unavailable."
    });
  }
});

/* =========================================================
   START GENERATION
========================================================= */

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

    /* -----------------------------------------------------
       VALIDATE
    ----------------------------------------------------- */

    if (!String(prompt).trim()) {

      return res.status(400).json({
        ok: false,
        error: "Please describe your song first."
      });

    }

    /* -----------------------------------------------------
       BUILD PROMPT
    ----------------------------------------------------- */

    const finalPrompt =
      `${genre}, ${mood}, ${String(prompt).trim()}, ` +
      "professional commercial music production, " +
      "strong groove, memorable melody, polished mix, " +
      "clear vocals, balanced mastering";

    /* -----------------------------------------------------
       BUILD LYRICS
    ----------------------------------------------------- */

    const finalLyrics =
      String(lyrics).trim() ||
      makeLyrics(String(prompt).trim());

    console.log("------------------------------------------");
    console.log("NEW MUSIC GENERATION");
    console.log("------------------------------------------");
    console.log("Prompt:", finalPrompt);
    console.log("Lyrics:", finalLyrics.length, "characters");

    /* -----------------------------------------------------
       CONNECT
    ----------------------------------------------------- */

    const client = await getClient();

    /* =====================================================
       ACE-STEP GENERATION INPUTS

       These are the inputs used by the current
       /generation_wrapper endpoint.
    ===================================================== */

    const inputs = [

      // 1. Model
      "acestep-v15-xl-turbo",

      // 2. Generation mode
      "custom",

      // 3. simple_query_input
      finalPrompt,

      // 4. simple_vocal_language
      vocalLanguage,

      // 5. prompt
      finalPrompt,

      // 6. lyrics
      finalLyrics,

      // 7. audio duration / related control
      0,

      // 8. reference audio
      "",

      // 9. key
      key || "",

      // 10. vocal language
      vocalLanguage,

      // 11. inference steps
      8,

      // 12. guidance scale
      7,

      // 13. thinking / enhancement
      true,

      // 14. seed
      "-1",

      // 15. audio reference
      null,

      // 16. seed
      -1,

      // 17. batch size
      2,

      // 18
      null,

      // 19
      null,

      // 20
      0,

      // 21
      -1,

      // 22. semantic mask prompt
      "Fill the audio semantic mask based on the given conditions:",

      // 23. batch
      1,

      // 24. task type
      "text2music",

      // 25
      false,

      // 26
      0,

      // 27
      1,

      // 28
      3,

      // 29
      "ode",

      // 30
      "",

      // 31. format
      "mp3",

      // 32
      0.85,

      // 33
      true,

      // 34
      2,

      // 35
      0,

      // 36
      0.9,

      // 37
      "NO USER INPUT",

      // 38
      true,

      // 39
      true,

      // 40
      true,

      // 41
      null,

      // 42
      false,

      // 43
      true,

      // 44
      false,

      // 45
      false,

      // 46
      0.5,

      // 47
      "8",

      // 48
      null,

      // 49
      false
    ];

    console.log("Submitting job to ACE-Step...");

    /* -----------------------------------------------------
       SUBMIT JOB

       IMPORTANT:
       The array is passed directly.
    ----------------------------------------------------- */

    const job = client.submit(
      "/generation_wrapper",
      inputs
    );

    /* -----------------------------------------------------
       CREATE OUR OWN JOB ID
    ----------------------------------------------------- */

    const id =
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

    /* -----------------------------------------------------
       JOB STATE
    ----------------------------------------------------- */

    const state = {
      status: "starting",
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

    console.log("Our job ID:", id);

    /* =====================================================
       LISTEN TO ACE-STEP EVENT STREAM
    ===================================================== */

    (async () => {

      try {

        state.status = "queued";

        for await (const message of job) {

          console.log(
            "ACE-Step event:",
            JSON.stringify(message)
          );

          state.lastEvent = message;

          /* ===============================================
             STATUS EVENT
          =============================================== */

          if (message?.type === "status") {

            const status =
              message?.status ||
              message?.stage ||
              "";

            console.log(
              `ACE-Step status [${id}]:`,
              status
            );

            // Queueing
            if (
              status === "pending" ||
              status === "queued"
            ) {
              state.status = "queued";
            }

            // Generation
            else if (
              status === "generating" ||
              status === "processing"
            ) {
              state.status = "generating";
            }

            // Complete
            else if (
              status === "complete" ||
              status === "completed"
            ) {

              if (!state.audioUrl) {
                state.status = "processing";
              }
            }

            // Error
            else if (
              status === "error" ||
              message?.success === false
            ) {

              state.status = "failed";

              state.error =
                message?.message ||
                message?.error ||
                message?.code ||
                "ACE-Step reported a generation error.";

              console.error(
                `ACE-Step generation error [${id}]:`,
                state.error
              );

              break;
            }
          }

          /* ===============================================
             DATA EVENT
          =============================================== */

          if (message?.type === "data") {

            console.log(
              `ACE-Step DATA received [${id}]`
            );

            const data = message?.data;

            state.result = data;

            /* ---------------------------------------------
               Try to find actual audio URL
            --------------------------------------------- */

            const audioUrl =
              findAudioUrl(data);

            if (audioUrl) {

              state.audioUrl = audioUrl;

              state.status = "succeeded";

              console.log(
                `AUDIO FOUND [${id}]:`,
                audioUrl
              );

            } else {

              console.log(
                `Data received but audio URL was not found [${id}]`
              );
            }
          }
        }

        /* =================================================
           STREAM FINISHED
        ================================================= */

        if (state.audioUrl) {

          state.status = "succeeded";

          console.log(
            `Generation SUCCESS [${id}]`
          );

        } else if (
          state.status !== "failed"
        ) {

          state.status = "failed";

          state.error =
            "ACE-Step completed the request but did not return an audio file. The free Hugging Face GPU may also have stopped or rejected the task.";

          console.error(
            `Generation ended without audio [${id}]`
          );
        }

      } catch (error) {

        console.error(
          `ACE-Step job error [${id}]:`,
          error
        );

        state.status = "failed";

        state.error =
          error?.message ||
          "ACE-Step generation failed.";

      }

    })();

    /* -----------------------------------------------------
       SEND JOB ID TO FRONTEND
    ----------------------------------------------------- */

    return res.json({
      ok: true,
      predictionId: id,
      status: "starting",
      provider: "ACE-Step 1.5"
    });

  } catch (error) {

    console.error(
      "Could not start generation:",
      error
    );

    // Reset connection if necessary
    aceClient = null;

    return res.status(503).json({
      ok: false,
      error:
        error?.message ||
        "ACE-Step could not start the generation."
    });
  }
});

/* =========================================================
   CHECK GENERATION STATUS
========================================================= */

app.get("/api/generate/:id", async (req, res) => {

  try {

    const id = req.params.id;

    const stored =
      global.musicJobs.get(id);

    /* -----------------------------------------------------
       JOB NOT FOUND
    ----------------------------------------------------- */

    if (!stored) {

      return res.status(404).json({
        ok: false,
        status: "not_found",
        error:
          "Generation job not found. It may have expired."
      });

    }

    const { state } = stored;

    /* -----------------------------------------------------
       SUCCESS
    ----------------------------------------------------- */

    if (state.status === "succeeded") {

      const response = {
        ok: true,
        status: "succeeded",
        audioUrl: state.audioUrl,
        result: state.result
      };

      // Remove completed job after returning it
      global.musicJobs.delete(id);

      return res.json(response);
    }

    /* -----------------------------------------------------
       FAILED
    ----------------------------------------------------- */

    if (state.status === "failed") {

      const errorMessage =
        state.error ||
        "ACE-Step generation failed.";

      // Keep failure briefly available
      global.musicJobs.delete(id);

      return res.status(500).json({
        ok: false,
        status: "failed",
        error: errorMessage
      });
    }

    /* -----------------------------------------------------
       PROCESSING
    ----------------------------------------------------- */

    return res.json({
      ok: false,
      status: state.status || "processing",
      message:
        state.status === "queued"
          ? "Your song is waiting for the AI GPU..."
          : "ACE-Step is generating your song..."
    });

  } catch (error) {

    console.error(
      "Status check error:",
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
   CANCEL GENERATION
========================================================= */

app.delete("/api/generate/:id", async (req, res) => {

  try {

    const id = req.params.id;

    const stored =
      global.musicJobs.get(id);

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

    } catch (cancelError) {

      console.warn(
        "Could not cancel ACE-Step job:",
        cancelError
      );
    }

    global.musicJobs.delete(id);

    return res.json({
      ok: true,
      status: "cancelled"
    });

  } catch (error) {

    return res.status(500).json({
      ok: false,
      error:
        error?.message ||
        "Could not cancel generation."
    });
  }
});

/* =========================================================
   CLEAN OLD JOBS
========================================================= */

setInterval(() => {

  const now = Date.now();

  for (const [id, stored] of global.musicJobs.entries()) {

    const age =
      now - (stored.state?.startedAt || now);

    // Remove jobs older than 20 minutes
    if (age > 20 * 60 * 1000) {

      console.log(
        `Removing expired job: ${id}`
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

  console.log("------------------------------------------");
  console.log("4TVIBEZ AI MUSIC STUDIO");
  console.log("------------------------------------------");
  console.log(`Server running on port ${PORT}`);
  console.log(`ACE-Step Space: ${HF_SPACE}`);
  console.log("------------------------------------------");

});
