import express from "express";
import { Client } from "@gradio/client";

const app = express();
const PORT = process.env.PORT || 3000;

// Official ACE-Step Space
const HF_SPACE = "ACE-Step/Ace-Step-v1.5";

app.use(express.json({ limit: "2mb" }));
app.use(express.static("."));

let aceClient = null;

// Store generation jobs
global.musicJobs = global.musicJobs || new Map();

/* =========================================================
   CONNECT TO ACE-STEP
========================================================= */

async function getClient() {
  if (!aceClient) {
    console.log("Connecting to ACE-Step...");

    aceClient = await Client.connect(HF_SPACE);

    console.log("Connected to ACE-Step.");
  }

  return aceClient;
}

/* =========================================================
   CREATE FALLBACK LYRICS
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
   HEALTH CHECK
========================================================= */

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

    console.error("Health check error:", error);

    res.status(503).json({
      ok: false,
      error:
        error?.message ||
        "ACE-Step is not available."
    });
  }
});

/* =========================================================
   START MUSIC GENERATION
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

    /* -----------------------------------------
       Validate prompt
    ----------------------------------------- */

    if (!prompt.trim()) {

      return res.status(400).json({
        error: "Please describe your song first."
      });

    }

    /* -----------------------------------------
       Build music prompt
    ----------------------------------------- */

    const finalPrompt =
      `${genre}, ${mood}, ${prompt.trim()}, ` +
      "professional commercial music production, " +
      "strong groove, memorable melody, polished mix";

    /* -----------------------------------------
       Build lyrics
    ----------------------------------------- */

    const finalLyrics =
      lyrics.trim() ||
      makeLyrics(prompt.trim());

    console.log("Music prompt:", finalPrompt);
    console.log("Lyrics length:", finalLyrics.length);

    /* -----------------------------------------
       Connect to ACE-Step
    ----------------------------------------- */

    const client = await getClient();

    /* =====================================================
       ACE-STEP GENERATION PARAMETERS

       These parameters match the current
       ACE-Step /generation_wrapper API.
    ===================================================== */

    const inputs = [

      // 1
      "acestep-v15-xl-turbo",

      // 2
      "custom",

      // 3
      // simple_query_input
      finalPrompt,

      // 4
      // simple_vocal_language
      vocalLanguage,

      // 5
      finalPrompt,

      // 6
      finalLyrics,

      // 7
      0,

      // 8
      "",

      // 9
      key || "",

      // 10
      vocalLanguage,

      // 11
      8,

      // 12
      7,

      // 13
      true,

      // 14
      "-1",

      // 15
      null,

      // 16
      -1,

      // 17
      2,

      // 18
      null,

      // 19
      null,

      // 20
      0,

      // 21
      -1,

      // 22
      "Fill the audio semantic mask based on the given conditions:",

      // 23
      1,

      // 24
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

      // 31
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

    console.log(
      "Sending generation request to ACE-Step..."
    );

    /* =====================================================
       START GRADIO JOB

       IMPORTANT:
       submit() receives the array directly.
    ===================================================== */

    const job = client.submit(
      "/generation_wrapper",
      inputs
    );

    /* -----------------------------------------
       Create our own ID
    ----------------------------------------- */

    const id =
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

    /* -----------------------------------------
       Create job state
    ----------------------------------------- */

    const state = {
      status: "processing",
      result: null,
      error: null
    };

    global.musicJobs.set(id, {
      job,
      state
    });

    /* =====================================================
       IMPORTANT FIX

       ACE-Step/Gradio sends results through the
       async event stream.

       We listen to that stream immediately.
    ===================================================== */

    (async () => {

      try {

        console.log(
          `ACE-Step job ${id} started.`
        );

        for await (const message of job) {

          console.log(
            `ACE-Step event for ${id}:`,
            JSON.stringify(message)
          );

          /* -----------------------------------------
             STATUS EVENT
          ----------------------------------------- */

          if (message?.type === "status") {

            const status =
              message?.status ||
              message?.stage ||
              "";

            console.log(
              `ACE-Step status ${id}:`,
              status
            );

            if (
              status === "error" ||
              message?.success === false
            ) {

              state.status = "failed";

              state.error =
                message?.message ||
                message?.error ||
                "ACE-Step generation failed.";

              return;
            }
          }

          /* -----------------------------------------
             DATA EVENT
          ----------------------------------------- */

          if (message?.type === "data") {

            console.log(
              `ACE-Step returned data for ${id}`
            );

            state.result = message.data;

            state.status = "succeeded";
          }
        }

        /* -----------------------------------------
           If stream ended with data, success.
        ----------------------------------------- */

        if (state.result !== null) {

          state.status = "succeeded";

        } else if (state.status !== "failed") {

          state.status = "failed";

          state.error =
            "ACE-Step finished without returning audio.";

        }

        console.log(
          `ACE-Step job ${id} finished:`,
          state.status
        );

      } catch (error) {

        console.error(
          `ACE-Step job ${id} error:`,
          error
        );

        state.status = "failed";

        state.error =
          error?.message ||
          "ACE-Step generation failed.";
      }

    })();

    /* -----------------------------------------
       Send ID back to website
    ----------------------------------------- */

    res.json({
      ok: true,
      predictionId: id,
      status: "starting",
      provider: "ACE-Step V1.5"
    });

  } catch (error) {

    console.error(
      "Could not start generation:",
      error
    );

    res.status(503).json({
      error:
        error?.message ||
        "ACE-Step could not start the generation."
    });
  }
});

/* =========================================================
   CHECK GENERATION RESULT
========================================================= */

app.get("/api/generate/:id", async (req, res) => {

  try {

    global.musicJobs =
      global.musicJobs ||
      new Map();

    const stored =
      global.musicJobs.get(
        req.params.id
      );

    /* -----------------------------------------
       Job not found
    ----------------------------------------- */

    if (!stored) {

      return res.status(404).json({
        error: "Generation job not found."
      });

    }

    const { state } = stored;

    /* -----------------------------------------
       SUCCESS
    ----------------------------------------- */

    if (
      state.status === "succeeded"
    ) {

      const result = state.result;

      global.musicJobs.delete(
        req.params.id
      );

      return res.json({
        ok: true,
        status: "succeeded",
        result
      });
    }

    /* -----------------------------------------
       FAILURE
    ----------------------------------------- */

    if (
      state.status === "failed"
    ) {

      global.musicJobs.delete(
        req.params.id
      );

      return res.status(500).json({
        ok: false,
        status: "failed",
        error:
          state.error ||
          "ACE-Step generation failed."
      });
    }

    /* -----------------------------------------
       STILL PROCESSING
    ----------------------------------------- */

    return res.json({
      ok: false,
      status: "processing"
    });

  } catch (error) {

    console.error(
      "Generation status error:",
      error
    );

    return res.status(503).json({
      error:
        error?.message ||
        "Could not check generation status."
    });
  }
});

/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, () => {

  console.log(
    `4TVIBEZ AI Music Studio running on port ${PORT}`
  );

  console.log(
    `ACE-Step Space: ${HF_SPACE}`
  );

});
