import { useSyncExternalStore } from "react";

function subscribe(notify: () => void) {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {window.removeEventListener("online", notify); window.removeEventListener("offline", notify);};
}
const getOnline = () => navigator.onLine;
const getServerOnline = () => true;

export default function ConnectionStatus() {
  const online = useSyncExternalStore(subscribe, getOnline, getServerOnline);
  return online ? null : <div className="connection-status" role="status">Интернэт холболт тасарсан байна. Wi-Fi эсвэл мобайл датагаа шалгаарай.</div>;
}
