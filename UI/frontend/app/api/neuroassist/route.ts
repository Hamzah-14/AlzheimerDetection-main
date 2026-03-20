// app/api/neuroassist/route.ts --- Groq version
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { messages, system } = await req.json();

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1000,
      messages: [
        { role: "system", content: system },
        ...messages,
      ],
    }),
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    console.error("Groq API error:", JSON.stringify(data, null, 2));
    return NextResponse.json(
      { content: [{ text: `Groq error: ${data.error?.message ?? res.status}` }] },
      { status: 200 }
    );
  }

  const text = data.choices?.[0]?.message?.content ?? "Sorry, I couldn't process that.";

  return NextResponse.json({
    content: [{ text }],
  });
}
