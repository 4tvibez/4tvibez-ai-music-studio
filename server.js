import express from "express";
import { Client } from "@gradio/client";

const app = express();
const PORT = process.env.PORT || 3000;

const ACE_STEP_SPACE =
  process.env.ACE_STEP_SPACE || "ACE-Step/Ace-Step-v1.5";
const ACE_STEP_API =
  process.env.ACE_STEP_API || "/generate_with_progress";
const ACE_STEP_TOKEN =
  process.env.ACE_STEP_TOKEN || "";

let aceClientPromise = null;

app.use(express.json({ limit: "2mb" }));
app.use(express.static(process.cwd()));

async function getAceClient() {
  if (!aceClientPromise) {
    aceClientPromise = Client.connect(
      ACE_STEP_SPACE,
      ACE_STEP_TOKEN ? { token: ACE_STEP_TOKEN } : undefined
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

    const payload = {
      captions: caption,
      lyrics: Boolean(instrumental)
        ? "[Instrumental]"
        : songLyrics,
      bpm: bpm === undefined || bpm === null || bpm === ""
        ? 0
        : Number(bpm),
      key_scale: String(key_scale ?? key ?? "").trim(),
      time_signature: "",
      vocal_language: String(
        vocal_language ?? vocalLanguage ?? "unknown"
      ).trim() || "unknown",
      inference_steps: 8,
      guidance_scale: 7,
      random_seed_checkbox: true,
      seed: "-1",
      reference_audio: null,
      audio_duration: seconds,
      batch_size_input: 1,
      src_audio: null,
      text2music_audio_code_string: "",
      repainting_start: 0,
      repainting_end: -1,
      instruction_display_gen: "",
      audio_cover_strength: 1,
      task_type: "text2music",
      use_adg: false,
      cfg_interval_start: 0,
      cfg_interval_end: 1,
      shift: 3,
      infer_method: "ode",
      custom_timesteps: "",
      audio_format: "mp3",
      lm_temperature: 0.85,
      think_checkbox: true,
      lm_cfg_scale: 2,
      lm_top_k: 0,
      lm_top_p: 0.9,
      lm_negative_prompt: "NO USER INPUT",
      use_cot_metas: true,
      use_cot_caption: true,
      use_cot_language: true,
      is_format_caption: false,
      constrained_decoding_debug: false,
      allow_lm_batch: true,
      lm_batch_chunk_size: 8,
      auto_score: false,
      auto_lrc: false,
      score_scale: 0.5
    };

    console.log("Connecting to ACE-Step:", ACE_STEP_SPACE);
    const client = await getAceClient();

    const result = await client.predict(ACE_STEP_API, payload);
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
