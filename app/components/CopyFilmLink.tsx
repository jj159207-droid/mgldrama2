"use client";
import { useState } from "react";
import { filmShareUrl } from "@/lib/film-link";

export default function CopyFilmLink({id, title}: {id: number; title: string}) {
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const copy = async () => {
    const url = filmShareUrl(window.location.origin, id);
    setLink(url);
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Хуулагдлаа. Facebook зарын Website URL хэсэгт тавиарай.");
    } catch {
      setMessage("Доорх холбоос дээр дарж сонгоод өөрөө хуулна уу.");
    }
  };
  return <div className="film-share">
    <button className="secondary-button" onClick={copy} aria-label={`${title}: зарын холбоос хуулах`}>Зарын холбоос хуулах</button>
    {link && <label><span>Энэ киноны холбоос</span><input readOnly value={link} aria-label={`${title}: киноны холбоос`} onFocus={event => event.currentTarget.select()} onClick={event => event.currentTarget.select()} /></label>}
    <p role="status">{message}</p>
  </div>;
}
