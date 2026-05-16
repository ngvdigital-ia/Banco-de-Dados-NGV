import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const GROQ_TRANSCRIBE_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_MODEL = "whisper-large-v3-turbo";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY não configurada" },
      { status: 500 },
    );
  }

  const formData = await req.formData();
  const audioFile = formData.get("audio");
  if (!(audioFile instanceof File)) {
    return NextResponse.json(
      { error: "audio file missing" },
      { status: 400 },
    );
  }

  if (audioFile.size > 25 * 1024 * 1024) {
    return NextResponse.json({ error: "audio > 25MB" }, { status: 413 });
  }

  // Groq aceita o mesmo formato do OpenAI Whisper API
  const groqForm = new FormData();
  groqForm.append("file", audioFile);
  groqForm.append("model", GROQ_MODEL);
  groqForm.append("language", "pt");

  const groqRes = await fetch(GROQ_TRANSCRIBE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: groqForm,
  });

  if (!groqRes.ok) {
    const errText = await groqRes.text();
    console.error("Groq Whisper error:", errText);
    return NextResponse.json(
      {
        error: "Groq Whisper transcription failed",
        details: errText.slice(0, 300),
      },
      { status: groqRes.status },
    );
  }

  const data = (await groqRes.json()) as { text?: string };
  return NextResponse.json({ text: data.text ?? "" });
}
