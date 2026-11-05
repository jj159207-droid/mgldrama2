"use client";

import { useState } from "react";

const SAMPLE_URL = "https://pub-9744153e7b2d41df9aad6475c60db5e4.r2.dev/42.mp4";

export default function R2DemoPage() {
  const [confirmed, setConfirmed] = useState(false);
  const [playbackError, setPlaybackError] = useState("");
  return (
    <main style={{ minHeight: "100dvh", background: "#080b11", color: "#f3f5f7", padding: "max(20px, env(safe-area-inset-top)) 16px max(20px, env(safe-area-inset-bottom))", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 780, margin: "0 auto" }}>
        <a href="/" style={{ display: "inline-block", color: "#efb65b", marginBottom: 24, textDecoration: "none", padding: "10px 0" }}>← TAZA нүүр хуудас</a>
        <h1 style={{ fontSize: "clamp(22px, 5vw, 32px)", margin: "0 0 8px" }}>Cloudflare R2 — видео туршилт</h1>
        <p style={{ color: "#adb8c7", lineHeight: 1.7, margin: "0 0 24px" }}>
          Cloudflare-д өмнө нь хадгалсан 42.mp4 файлыг Android, iPhone болон компьютерын браузерт тоглуулж шалгах тусдаа хуудас.
        </p>
        {!confirmed ? (
          <section style={{ border: "1px solid #364456", borderRadius: 16, padding: 24, background: "#121923" }}>
            <h2 style={{ fontSize: 20, margin: "0 0 12px" }}>Насны баталгаажуулалт</h2>
            <p style={{ color: "#adb8c7", lineHeight: 1.65, marginBottom: 20 }}>Энэ сайт нь 21-ээс дээш насныханд зориулагдсан. Та 21 нас хүрсэн үү?</p>
            <button type="button" onClick={() => setConfirmed(true)} style={{ border: 0, borderRadius: 12, minHeight: 48, padding: "0 24px", fontSize: 16, fontWeight: 700, background: "#efb65b", color: "#10161f", cursor: "pointer" }}>Тийм, 21 нас хүрсэн</button>
          </section>
        ) : (
          <section style={{ border: "1px solid #354153", borderRadius: 16, padding: 16, background: "#121923" }}>
            <video aria-label="Cloudflare R2 туршилтын видео" controls playsInline preload="metadata" onError={() => setPlaybackError("Видео ачаалсангүй. R2 холбоос, видео формат эсвэл сүлжээний хязгаарлалтыг шалгана уу.")} onLoadedMetadata={() => setPlaybackError("")} style={{ display: "block", width: "100%", aspectRatio: "16/9", background: "#000", borderRadius: 10 }}>
              <source src={SAMPLE_URL} type="video/mp4" />
              Таны браузер MP4 видео тоглуулахгүй байна.
            </video>
            {playbackError && <p role="alert" style={{ color: "#ff9d9d", margin: "12px 0 0", lineHeight: 1.6 }}>{playbackError}</p>}
            <p style={{ color: "#adb8c7", fontSize: 14, lineHeight: 1.6, margin: "16px 0 0" }}>Видео: video/42.mp4 · Хэмжээ: ойролцоогоор 5.98 MB · Эх сурвалж: Cloudflare R2</p>
          </section>
        )}
        <p style={{ color: "#8290a2", marginTop: 20, fontSize: 13, lineHeight: 1.75 }}>
          Зөвхөн холболт шалгах зориулалттай. R2-ийн r2.dev public development холбоос нь хурдны хязгаартай бөгөөд төлбөртэй киноны жинхэнэ хамгаалалт биш. Үндсэн киноны эрх, мэдээлэлд өөрчлөлт оруулахгүй.
        </p>
      </div>
    </main>
  );
}
