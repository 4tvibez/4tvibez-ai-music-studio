import express from "express";
import { Client } from "@gradio/client";

const app = express();
const PORT = process.env.PORT || 3000;

const ACE_STEP_SPACE =
  process.env.ACE_STEP_SPACE || "ACE-Step/Ace-Step-v1.5";
const ACE_STEP_API =
  process.env.ACE_STEP_API || "/generation_wrapper";
const HF_TOKEN =
  process.env.HF_TOKEN || process.env.ACE_STEP_TOKEN || "";

let aceClientPromise = null;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(process.cwd()));

async function getAceClient() {
  if (!aceClientPromise) {
    aceClientPromise = Client.connect(
      ACE_STEP_SPACE,
      HF_TOKEN ? { token: HF_TOKEN } : undefined
    ).catch((error) => {
      aceClientPromise = null;
      throw error;
    });
  }
  return aceClientPromise;
}

function findAudio(value) {
  if (!value) return null;
  if (typeof value === "string") {
    if (
      value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.endsWith(".mp3") ||
      value.endsWith(".wav") ||
      value.endsWith(".flac")
    ) return value;
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAudio(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    for (const key of ["url", "path", "file", "audio", "name"]) {
      if (key in value) {
        const found = findAudio(value[key]);
        if (found) return found;
      }
    }
    for (const valueItem of Object.values(value)) {
      const found = findAudio(valueItem);
      if (found) return found;
    }
  }
  return null;
}

app.get("/api/health", async (req, res) => {
  try {
    const client = await getAceClient();
    const api = await client.view_api();
    const endpoints = Object.keys(api?.named_endpoints || {});
    res.json({
      ok: true,
      provider: "ACE-Step 1.5",
      space: ACE_STEP_SPACE,
      endpoint: ACE_STEP_API,
      endpoints
    });
  } catch (error) {
    console.error("ACE-Step connection error:", error);
    res.status(503).json({
      ok: false,
      provider: "ACE-Step 1.5",
      space: ACE_STEP_SPACE,
      error: error.message
    });
  }
});

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

    const caption =
      String(prompt || "").trim() ||
      "A beautiful modern Afrobeats song with warm guitar, deep bass, rhythmic drums, catchy melody and emotional vocals.";

    const songLyrics = String(lyrics || "").trim();

    const seconds = Math.min(
      Math.max(
        Number(audio_duration ?? duration ?? 30) || 30,
        10
      ),
      600
    );

    const payload = [
      "acestep-v15-xl-turbo", // selected_model
      "custom",                // generation_mode
      "",                      // simple_query_input
      "en",                     // simple_vocal_language

      caption,                 // captions
      songLyrics,              // lyrics
      bpm === undefined || bpm === null || bpm === "" ? null : Number(bpm), // bpm
      String(key_scale ?? key ?? "").trim(), // key_scale
      "4/4",                   // time_signature
      String(vocal_language ?? vocalLanguage ?? "en").trim() || "en", // vocal_language

      8,                       // inference_steps
      7,                       // guidance_scale
      true,                    // random_seed_checkbox
      -1,                      // seed
      null,                    // reference_audio
      seconds,                 // audio_duration
      1,                       // batch_size
      null,                    // src_audio
      "",                      // text2music_audio_code_string
      0,                       // repainting_start
      -1,                      // repainting_end
      "Fill the audio semantic mask based on the given conditions:", // instruction
      1,                       // audio_cover_strength
      "text2music",             // task_type

      false,                    // use_adg
      0,                        // cfg_interval_start
      1,                        // cfg_interval_end
      1,                        // shift
      "ode",                    // infer_method
      "",                       // custom_timesteps
      "mp3",                    // audio_format

      0.85,                     // lm_temperature
      true,                     // think_checkbox
      2,                        // lm_cfg_scale
      0,                        // lm_top_k
      0.9,                      // lm_top_p
      "NO USER INPUT",           // lm_negative_prompt
      true,                     // use_cot_metas
      true,                     // use_cot_caption
      true,                     // use_cot_language
      false,                    // is_format_caption_state
      false,                    // constrained_decoding_debug
      true,                     // allow_lm_batch
      false,                    // auto_score
      false,                    // auto_lrc
      0.5,                      // score_scale
      8,                        // lm_batch_chunk_size
      null,                     // track_name
      [],                       // complete_track_classes
      false,                    // autogen_checkbox
      0,                        // current_batch_index
      1,                        // total_batches
      [],                       // batch_queue
      {}                        // generation_params_state
    ];
    console.log("Connecting to ACE-Step:", ACE_STEP_SPACE);
    const client = await getAceClient();

    console.log("Sending generation request to ACE-Step...");
    const result = await Promise.race([
      client.predict(ACE_STEP_API, payload),
      new Promise((_, reject) => setTimeout(() => reject(new Error("ACE-Step generation timed out after 8 minutes.")), 480000))
    ]);
    const data = result?.data ?? result;

    const audio = findAudio(data);

    if (!audio) {
      console.error("ACE-Step returned:", JSON.stringify(data));
      return res.status(502).json({
        ok: false,
        error: "ACE-Step completed without returning an audio file.",
        response: data
      });
    }

    res.json({
      ok: true,
      status: "succeeded",
      audio
    });
  } catch (error) {
    console.error("Generation error:", error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.get("/{*splat}", (req, res) => {
  res.sendFile(`${process.cwd()}/index.html`);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`4TVIBEZ AI Music Studio running on port ${PORT}`);
  console.log(`ACE-Step Space: ${ACE_STEP_SPACE}`);
  console.log(`ACE-Step endpoint: ${ACE_STEP_API}`);
});
