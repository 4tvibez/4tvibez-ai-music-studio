import express from "express";

const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.REPLICATE_API_TOKEN;

app.use(express.json({limit:"1mb"}));
app.use(express.static("."));

app.get("/api/health", (_req,res) => {
  res.json({ok:true, provider:TOKEN ? "replicate" : "not-configured", message:TOKEN ? "AI music backend is connected." : "Add REPLICATE_API_TOKEN in Railway Variables."});
});

function makeLyrics(prompt, genre, mood) {
  const clean = prompt.replace(/\s+/g," ").trim().slice(0,500);
  return `[Intro]\n(${genre} atmosphere, ${mood} mood)\n\n[Verse]\n${clean}\n\n[Pre Chorus]\nI can feel the rhythm rising\nEvery heartbeat comes alive\n\n[Chorus]\nTurn these feelings into music\nLet the whole world hear the sound\n${clean}\n\n[Verse]\nWe keep moving through the moment\nWith a melody we found\n\n[Chorus]\nTurn these feelings into music\nLet the whole world hear the sound\n${clean}\n\n[Outro]\nLet the music carry on`;
}

app.post("/api/generate", async (req,res) => {
  try {
    if(!TOKEN) return res.status(503).json({error:"AI backend is not connected. Add REPLICATE_API_TOKEN in Railway Variables."});
    const {prompt,genre="Afrobeats",mood="Romantic",duration="2-3 minutes",lyrics=""}=req.body||{};
    if(!prompt?.trim()) return res.status(400).json({error:"Describe your song first."});

    const musicPrompt = `${genre}, ${mood}, ${prompt.trim()}. Professional modern production, memorable melody, clear arrangement, polished mix.`;
    const input = {
      prompt:musicPrompt.slice(0,2000),
      lyrics:(lyrics?.trim() || makeLyrics(prompt,genre,mood)).slice(0,3500),
      bitrate:256000,
      sample_rate:44100,
      audio_format:"mp3"
    };

    const create=await fetch("https://api.replicate.com/v1/models/minimax/music-2.5/predictions",{
      method:"POST",
      headers:{Authorization:`Bearer ${TOKEN}`,"Content-Type":"application/json",Prefer:"wait=5"},
      body:JSON.stringify({input})
    });
    const prediction=await create.json();
    if(!create.ok) return res.status(create.status).json({error:prediction?.detail||prediction?.error||"Replicate rejected the generation request."});
    res.json({ok:true,predictionId:prediction.id,status:prediction.status||"starting"});
  } catch(err){
    console.error("Generate error:",err);
    res.status(500).json({error:"The music server could not reach the AI provider. Please try again."});
  }
});

app.get("/api/generate/:id",async(req,res)=>{
  try{
    if(!TOKEN) return res.status(503).json({error:"REPLICATE_API_TOKEN is missing."});
    const r=await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(req.params.id)}`,{headers:{Authorization:`Bearer ${TOKEN}`}});
    const data=await r.json();
    if(!r.ok) return res.status(r.status).json({error:data?.detail||data?.error||"Could not check generation status."});
    const audio=typeof data.output==="string"?data.output:Array.isArray(data.output)?data.output[0]:data.output?.url||null;
    res.json({ok:data.status==="succeeded",status:data.status,audio,error:data.error||null});
  }catch(err){
    console.error("Status error:",err);
    res.status(500).json({error:"Could not check the AI generation status."});
  }
});

app.listen(PORT,()=>console.log(`4TVIBEZ AI Music Studio running on port ${PORT}`));
