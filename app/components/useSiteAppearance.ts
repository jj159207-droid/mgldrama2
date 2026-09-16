"use client";
import {useCallback, useEffect, useRef, useState} from "react";
import {requestJson} from "@/lib/client";
import {appearanceStyle, DEFAULT_APPEARANCE, validAppearance, type SiteAppearance} from "@/lib/appearance";

export default function useSiteAppearance() {
  const [appearance,setAppearance] = useState<SiteAppearance>({...DEFAULT_APPEARANCE});
  const request = useRef(0);
  const apply = useCallback((next: SiteAppearance) => {
    request.current++;
    setAppearance(current => next.revision >= current.revision ? next : current);
  },[]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      const generation = ++request.current;
      try {
        const data = await requestJson("/api/appearance",{},true);
        if (active && generation === request.current && validAppearance(data.appearance)) {
          setAppearance(current => data.appearance.revision >= current.revision ? data.appearance : current);
        }
      } catch {} // A temporary outage keeps the last working appearance.
    };
    const refresh = () => {if (document.visibilityState !== "hidden") void load();};
    void load();
    window.addEventListener("focus",refresh);window.addEventListener("online",refresh);
    document.addEventListener("visibilitychange",refresh);
    return () => {active=false;window.removeEventListener("focus",refresh);window.removeEventListener("online",refresh);document.removeEventListener("visibilitychange",refresh);};
  },[]);
  useEffect(() => {
    const root = document.documentElement;
    const values = appearanceStyle(appearance);
    const previous = Object.keys(values).map(key=>[key,root.style.getPropertyValue(key)]);
    Object.entries(values).forEach(([key,value])=>root.style.setProperty(key,value));
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const oldColor = meta?.content;
    if (meta) meta.content = values["--background"];
    return () => {previous.forEach(([key,value])=>value?root.style.setProperty(key,value):root.style.removeProperty(key));if(meta && oldColor)meta.content=oldColor;};
  },[appearance]);
  return {appearance,apply};
}
