"use client";

import { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";

const DEFAULT_PROMPT =
  "Sepya tonlarında, gravür dokulu, sinematik ışıklı bir illüstrasyon: loş bir çocuk odasında kulaklık takmış bir çocuk sırtı dönük oturuyor, masa lambasının sıcak ışığı, duvarda belli belirsiz eski posterler. Nostaljik, sıcak, büyülü bir \"ilk kıvılcım\" anı hissi. Gerçek, tanınabilir bir kişinin yüzünü gösterme; figür silüet/arkadan olsun.";

function CardPreview({ imageUrl, fields }) {
  return (
    <div className="card">
      <div className="corner tl"></div><div className="corner tr"></div>
      <div className="corner bl"></div><div className="corner br"></div>
      <div className="card-border"></div>
      <div className="header">
        <div className="num">{fields.fNum}</div>
        <div className="title">{fields.fTitle}</div>
        <div className="subtitle">{fields.fSubtitle}</div>
      </div>
      <div className="subheader">{fields.fSong}</div>
      <div className="art">
        {imageUrl ? <img src={imageUrl} alt="" /> : "Görsel bekleniyor…"}
      </div>
      <div className="catbar"><span>{fields.fCategory}</span><span>♦</span></div>
      <div className="body-panel">
        <div className="desc">{fields.fDesc}</div>
        <div>
          <div className="divider">◆ ◇ ◆</div>
          <div className="credit-row">
            <div className="credit">{fields.fCredit}</div>
            <div className="badge">
              <div className="val">{fields.fBadgeVal}</div>
              <div className="lbl">{fields.fBadgeLbl}</div>
            </div>
          </div>
          <div className="footer-line">{fields.fFooter}</div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const { data: session, status } = useSession();
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [refFile, setRefFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cards, setCards] = useState([]);

  const [fields, setFields] = useState({
    fTitle: "9 YAŞ",
    fNum: "1/100",
    fSubtitle: "KEŞİF & BÜYÜLENME",
    fSong: "İLK KIVILCIM",
    fCategory: "Efsanevi Hayat Dönemi — Çocukluk",
    fDesc:
      "Bir çocuk, loş odada kulaklıklarıyla bir şarkı dinliyor. İlk kıvılcım çakıyor, bir dünya açılıyor.",
    fCredit: "♪ Sting — Fragile (1987) [Gothic Folk]",
    fBadgeVal: "9/10",
    fBadgeLbl: "KEŞİF",
    fFooter: "TM & © 2026 LifeInSound",
  });

  const setField = (key) => (e) => setFields((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    if (status === "authenticated") loadCards();
  }, [status]);

  async function loadCards() {
    const res = await fetch("/api/cards");
    if (res.ok) {
      const data = await res.json();
      setCards(data.cards);
    }
  }

  function fileToBase64(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(",")[1]);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  async function handleGenerate() {
    setError("");
    setLoading(true);
    try {
      let refImageBase64, refImageMime;
      if (refFile) {
        refImageBase64 = await fileToBase64(refFile);
        refImageMime = refFile.type;
      }
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, refImageBase64, refImageMime, ...fields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Üretim başarısız oldu.");
      setImageUrl(data.card.imageUrl);
      loadCards();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div>
          <h1>LifeInSound Kart Üretici</h1>
          <p className="tagline">Şarkı → çocukluk sahnesi → koleksiyon kartı</p>
        </div>
        {status === "authenticated" ? (
          <div className="userchip">
            <img src={session.user.image} alt="" />
            {session.user.name}
            <button className="authbtn" onClick={() => signOut()}>Çıkış</button>
          </div>
        ) : (
          <button className="authbtn" onClick={() => signIn("google")}>Google ile Giriş</button>
        )}
      </div>

      {status !== "authenticated" ? (
        <div className="panel" style={{ gridColumn: "1/-1" }}>
          Kart üretmek için Google hesabınızla giriş yapın.
        </div>
      ) : (
        <>
          <div>
            <div className="panel">
              <h2>1 · AI Sanat</h2>
              <label>Referans görsel (opsiyonel)</label>
              <input type="file" accept="image/*" onChange={(e) => setRefFile(e.target.files[0])} />
              <label>Stil / sahne talimatı</label>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} />
              <div className="hint">
                Gerçek ünlülerin tanınabilir yüzünü isteme — çoğu görsel model bunu reddeder. Sahneyi/atmosferi tarif edin.
              </div>
              <button className="primary" disabled={loading} onClick={handleGenerate}>
                {loading ? "Üretiliyor…" : "🎨 Kartı Oluştur"}
              </button>
              {error && <div className="status error">{error}</div>}
            </div>

            <div className="panel">
              <h2>2 · Kart Metinleri</h2>
              <div className="row2">
                <div><label>Başlık</label><input value={fields.fTitle} onChange={setField("fTitle")} /></div>
                <div><label>Kart no.</label><input value={fields.fNum} onChange={setField("fNum")} /></div>
              </div>
              <label>Alt başlık</label>
              <input value={fields.fSubtitle} onChange={setField("fSubtitle")} />
              <label>Şarkı / bölüm adı</label>
              <input value={fields.fSong} onChange={setField("fSong")} />
              <label>Kategori</label>
              <input value={fields.fCategory} onChange={setField("fCategory")} />
              <label>Açıklama</label>
              <textarea value={fields.fDesc} onChange={setField("fDesc")} />
              <label>Alt satır</label>
              <input value={fields.fCredit} onChange={setField("fCredit")} />
              <div className="row2">
                <div><label>Rozet değeri</label><input value={fields.fBadgeVal} onChange={setField("fBadgeVal")} /></div>
                <div><label>Rozet etiketi</label><input value={fields.fBadgeLbl} onChange={setField("fBadgeLbl")} /></div>
              </div>
              <label>Alt bilgi</label>
              <input value={fields.fFooter} onChange={setField("fFooter")} />
              <div className="warn">
                Gerçek, tanınabilir sanatçı yüzleri içeren kartları ticari üründe kullanmak telif/kişilik hakkı riski taşır.
              </div>
            </div>
          </div>

          <div className="stage">
            <CardPreview imageUrl={imageUrl} fields={fields} />
          </div>

          <div className="gallery">
            <h2>Kartlarım</h2>
            <div className="gallery-grid">
              {cards.map((c) => (
                <div className="gallery-item" key={c.id}>
                  <img src={c.imageUrl} alt={c.title} />
                  <div className="cap">{c.title} · {c.song}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
