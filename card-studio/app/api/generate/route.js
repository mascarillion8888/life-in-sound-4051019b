import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { put } from "@vercel/blob";
import { nanoid } from "nanoid";

const DAILY_LIMIT = 20; // simple per-user quota, adjust as needed

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return Response.json({ error: "Giriş yapmalısınız." }, { status: 401 });
  }

  const body = await req.json();
  const {
    prompt,
    refImageBase64,
    refImageMime,
    title,
    subtitle,
    song,
    category,
    description,
    credit,
    badgeVal,
    badgeLabel,
    footer,
  } = body;

  if (!prompt || typeof prompt !== "string") {
    return Response.json({ error: "Stil/sahne talimatı gerekli." }, { status: 400 });
  }

  // basic daily quota per user
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const countToday = await prisma.card.count({
    where: { userId: session.user.id, createdAt: { gte: since } },
  });
  if (countToday >= DAILY_LIMIT) {
    return Response.json(
      { error: `Günlük ${DAILY_LIMIT} kart üretim limitine ulaştınız.` },
      { status: 429 }
    );
  }

  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: "Sunucuda GEMINI_API_KEY tanımlı değil." }, { status: 500 });
  }

  try {
    const parts = [{ text: prompt }];
    if (refImageBase64 && refImageMime) {
      parts.push({ inline_data: { mime_type: refImageMime, data: refImageBase64 } });
    }

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts }] }),
      }
    );

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      return Response.json(
        { error: `Gemini API hatası: ${errText.slice(0, 300)}` },
        { status: 502 }
      );
    }

    const data = await geminiResp.json();
    const cand = data.candidates?.[0];
    const imgPart = cand?.content?.parts?.find((p) => p.inlineData || p.inline_data);
    const inline = imgPart && (imgPart.inlineData || imgPart.inline_data);

    if (!inline) {
      const textPart = cand?.content?.parts?.find((p) => p.text);
      return Response.json(
        {
          error: textPart
            ? `Model görsel yerine metin döndürdü: ${textPart.text.slice(0, 200)}`
            : "Model bir görsel döndürmedi. Gerçek/tanınabilir bir kişi istemiş olabilirsiniz — sahneyi kurgusallaştırın.",
        },
        { status: 422 }
      );
    }

    const mime = inline.mimeType || inline.mime_type || "image/png";
    const buffer = Buffer.from(inline.data, "base64");

    const blob = await put(`cards/${session.user.id}/${nanoid()}.png`, buffer, {
      access: "public",
      contentType: mime,
    });

    const card = await prisma.card.create({
      data: {
        userId: session.user.id,
        title: title || "9 YAŞ",
        subtitle: subtitle || "",
        song: song || "",
        category: category || "",
        description: description || "",
        credit: credit || "",
        badgeVal: badgeVal || "",
        badgeLabel: badgeLabel || "",
        footer: footer || "",
        imageUrl: blob.url,
      },
    });

    return Response.json({ card });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Beklenmeyen bir sunucu hatası oluştu." }, { status: 500 });
  }
}
