import { notFound, redirect } from "next/navigation";

export default async function FilmShortLinkPage({params}:{params:Promise<{filmId:string}>}) {
  const {filmId}=await params;
  if(!/^[1-9]\\d*$/.test(filmId))notFound();
  redirect("/kino-drama?film="+filmId);
}
