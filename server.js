import express from "express";
import { Client } from "@gradio/client";

const app = express();
const PORT = process.env.PORT || 3000;

const HF_SPACE = "ACE-Step/Ace-Step-v1.5";

app.use(express.json({ limit: "2mb" }));
app.use(express.static("."));

let aceClient = null;

async function getAceClient() {
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
${prompt}

[Outro]
Let the music carry on`;
}

app.get("/api/health", async (_req, res) => {
  try {
    const client = await getAceClient();

    await client.view_api();

    res.json({
      ok: true,
      provider: "ACE-Step V1.5",
      space: HF_SPACE
    });
  } catch (error) {
    console.error("ACE-Step health error:", error);

    res.status(503).json({
      ok: false,
      provider: "ACE-Step V1.5",
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
      bpm = 0,
      key = "",
      vocalLanguage = "unknown"
    } = req.body || {};

    if (!prompt.trim()) {
      return res.status(400).json({
        error: "Please describe the song you want to create."
      });
    }

    const finalPrompt =
      `${genre}, ${mood}, ${prompt.trim()}, ` +
      "professional commercial music production, " +
      "strong groove, memorable melody, polished mix";

    const finalLyrics =
      lyrics.trim() || makeLyrics(prompt.trim());

    const client = await getAceClient();

    /*
      These are the parameters captured by the
      ACE-Step API Recorder for /generation_wrapper.
    */

    const inputs = [
      "acestep-v15-xl-turbo", // selected_model
      "custom",               // generation_mode
      null,                   // simple_query_input
      vocalLanguage,          // simple_vocal_language
      finalPrompt,            // param_4
      finalLyrics,            // param_5
      0,                      // param_6
      "",                     // param_7
      key || "",              // param_8
      vocalLanguage,          // param_9
      8,                      // param_10
      7,                      // param_11
      true,                   // param_12 thinking
      "-1",                   // param_13
      null,                   // param_14
      -1,                     // param_15
      2,                      // param_16
      null,                   // param_17
      null,                   // param_18
      0,                      // param_19
      -1,                     // param_20
      "Fill the audio semantic mask based on the given conditions:",
      1,                      // param_22
      "text2music",           // param_23
      false,                  // param_24 instrumental
      0,                      // param_25
      1,                      // param_26
      3,                      // param_27
      "ode",                  // param_28
      "",                     // param_29
      "mp3",                  // param_30
      0.85,                   // param_31
      true,                   // param_32
      33,                     // param_33
      0,                      // param_34
      0.9,                    // param_35
      "NO USER INPUT",        // param_36
      true,                   // param_37
      true,                   // param_38
      true,                   // param_39
      null,                   // param_41
      false,                  // param_42
      true,                   // param_43
      false,                  // param_44
      false,                  // param_45
      0.5,                    // param_46
      "8",                    // param_47
      null                    // param_48
    ];

    /*
      Submit the generation job.

      submit() is used because music generation is a
      long-running operation.
    */

    const job = client.submit(
      "/generation_wrapper",
      inputs
    );

    const jobId =
      job?.event_id ||
      job?.id ||
      null;

    if (!jobId) {
      return res.status(502).json({
        error: "ACE-Step did not return a generation job ID."
      });
    }

    res.json({
      ok: true,
      predictionId: jobId,
      status: "starting",
      provider: "ACE-Step V1.5"
    });

  } catch (error) {
    console.error("Generation error:", error);

    res.status(503).json({
      error:
        error?.message ||
        "ACE-Step could not start the generation."
    });
  }
});

app.listen(PORT, () => {
  console.log(
    `4TVIBEZ AI Music Studio running on port ${PORT}`
  );
});
