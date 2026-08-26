import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

export async function POST(req: Request) {
  try {
    const { scriptText, videoSubject, videoTerms, duration, beats, timeline } = await req.json();

    if (!scriptText) {
      return NextResponse.json({ error: "Testo dello script mancante." }, { status: 400 });
    }

    const payload = JSON.stringify({
      id: `render_${Date.now()}`,
      script: scriptText,
      keywords: videoTerms
        ? videoTerms.split(",").map((k: string) => k.trim()).filter(Boolean)
        : ["technology", "smartphone", "artificial intelligence"],
      duration: duration || 30,
      subject: videoSubject || "Tech Documentary Short",
      beats: beats || timeline || [],
    });

    const scriptPath = path.join(process.cwd(), "render_engine.py");

    return new Promise((resolve) => {
      const pythonProcess = spawn("python", [scriptPath], {
        env: {
          ...process.env,
          GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
        },
      });

      let stdoutData = "";
      let stderrData = "";

      pythonProcess.stdin.write(payload);
      pythonProcess.stdin.end();

      pythonProcess.stdout.on("data", (data) => {
        stdoutData += data.toString();
        console.log("[Render Engine]:", data.toString());
      });

      pythonProcess.stderr.on("data", (data) => {
        stderrData += data.toString();
        console.error("[Render Engine Err]:", data.toString());
      });

      pythonProcess.on("close", (code) => {
        if (code !== 0) {
          resolve(
            NextResponse.json(
              { error: `Errore durante il rendering (codice ${code}): ${stderrData || stdoutData}` },
              { status: 500 }
            )
          );
        } else {
          resolve(
            NextResponse.json({
              success: true,
              log: stdoutData,
              message: "Video montato con successo con B-Roll mirati e Ken Burns in output_renders!",
            })
          );
        }
      });
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}