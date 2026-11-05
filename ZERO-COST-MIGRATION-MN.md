# TAZA кино сайт — 0₮ сарын зардалд ойртуулах шилжилт (туршилт)

2026-11-05. **Үндсэн сайт `taza.site` хэвээр; энэ мөчид үйлчилгээ цуцлахгүй.**
Энэ бол Render Free-д тусдаа preview ажиллуулах эхний бэлтгэл, бүрэн шилжүүлэлт **биш**.

## Одоогийн дэд бүтэц (код болон Vercel шалгалтаас)

- Вэб: Vercel `mgldrama2`, Next.js 16.3.4, `main` production.
- Мэдээллийн сан, postер, трейлэр: Supabase REST/Storage (`SUPABASE_URL`).
- Киноны үндсэн видео: Bunny Stream URL. `lib/trailer-media.ts` Bunny HLS болон FFmpeg ашигладаг.
- Код: GitHub `jj159207-droid/mgldrama2`.
- Домэйн: `taza.site` Vercel-д бүртгэлтэй, 2027-09-15-нд дуусна; авто сунгалт унтраалттай.
- Хэрэглэгчийн нэвтрэлт, PIN, админ, SMS төлбөр, үзэх эрх нь Next.js server-side API-уудтай. Зүгээр static export/Pages болгон хувиргаж **болохгүй**.
- Vercel дээр Pro төлөвлөгөөний сарын ~20 USD лицензийн тооцоо харагдсан. Бодит invoice тусад нь шалгана.

## Алхам 1: Render Free дээр тусдаа preview

1. Render аккаунтаа GitHub репотой холбож **Blueprint** үүсгэнэ. Энэ салбарын `render.yaml`-г ашиглана.
2. Шинэ web service-ийн **plan = free** гэдгийг баталгаажуулна. Нэмэлт database, төлбөртэй disk, нэмэлт үйлчилгээ үүсгэхгүй.
3. Системийн нууц хувьсагчдыг зөвхөн Render-ийн хаалттай Environment хэсэгт тохируулна. Нууц үг эсвэл түлхүүрийг GitHub, чат, build log-д хэзээ ч оруулахгүй.
   - `SUPABASE_URL` — одоогийн кино сайтын Supabase хаяг
   - `SUPABASE_SECRET_KEY` — серверийн нууц түлхүүр, зөвхөн сервер дээр
   - `ADMIN_PASSWORD` — preview-д тусдаа хүчтэй админ нууц үг
   - `SITE_URL` — Render-ээс олгосон бодит `https://....onrender.com` хаяг (яг origin)
4. Асаад `GET /api/health` 200 болон `ok:true` буцаах эсэхийг шалгана.
5. `/api/auth` нэвтрэлт, кино каталог, үзэх эрхийн алдаа, `/api/playback`, Bunny player, постер, гар утасны харагдац шалгана. Жинхэнэ төлбөрийн webhook болон бичлэг оруулахыг **production DB** дээр туршиж болохгүй.
6. `SITE_URL`-г сольсон тохиолдолд service-ээ redeploy хийнэ. Сонголттой SMS env хувьсагчдыг preview-д холбохгүй, бодит SMS-ийг хуулбарлан боловсруулахаас сэргийлнэ.
7. Preview амжилттай болсны дараа л `taza.site` DNS-ийг Render-ийн зааврын дагуу чиглүүлж, HTTPS, төлбөр, нэвтрэлт, Bunny player-ийг дахин шалгана.
8. Эцсийн DNS ба ажиллагааг шалгасны дараа Vercel Pro-г цуцлах/бууруулах шийдвэр гаргана. **Vercel Hobby нь арилжааны сайтанд тохирохгүй.**

**Анхаарах:** Render Free 512 MB RAM / 0.1 CPU-тай; 15 минут идэвхгүй бол унтаж дараагийн хүсэлтэд ~1 минут сэрнэ; сарын 750 instance-hour, bandwidth/build-ийн хязгаартай. Render нь Free web service-ийг үйлдвэрлэлийн орчинд санал болгодоггүй. Next.js 16 + FFmpeg дүүрэн ажиллана гэдгийг deploy, тестээр баталгаажуулах шаардлагатай.

## Алхам 2: Supabase Free үнэлгээ

Кино сайтын бодит Supabase аккаунтын plan, database size, object storage, egress, projects-ийг шалгах. 500 MB database, 1 GB file storage гэх мэт Free квотоос давсан эсэхийг баталгаажуулна. Free төсөл долоо хоног орчим бага идэвхтэй бол pause болох боломжтой. Төсөл устгахгүй, зураг/мэдээллийг backup-гүйгээр шилжүүлэхгүй.

## Алхам 3: Bunny Stream-ийг орлуулах боломж

Bunny Stream нь 1 USD/сар доод төлбөртэй. Киноны нийт хэмжээ, HLS renditions, сард дамжуулж буй GB болон эзэмших эрхийг шалгахгүйгээр цуцлах боломжгүй.

Cloudflare R2 Standard: 10 GB-month хадгалалт, сар бүр 1 сая Class A, 10 сая Class B operations, egress үнэгүй. Үүнээс давбал төлбөртэй. **R2 нь Bunny Stream шиг transcoding, adaptive streaming, video player-ийг автоматаар орлохгүй.** Шилжүүлэхийн өмнө файлуудын хэмжээ, форматыг шалгаж, видео экспорт, playback, CDN, зөвшөөрөл, хамгаалалтыг тусдаа төлөвлөнө.

## Алхам 4: Жил бүрийн ба үлдсэн зардал

- `taza.site`: одоогийн бүртгэл ирэх жил хүртэл хүчинтэй, сунгалт хийвэл жил тутмын үнэ гарна. Тэгвэл жилийн зардал 0 биш.
- GitHub public репо: энгийн Free GitHub-д тохирно. Paid Actions/minutes, storage addons байгаа эсэхийг шалгана.
- MacroDroid / SMS / SIM: төлбөрийн үйлчилгээний болон операторын зардал тусдаа.
- Контентын лиценз ба хуулийн зөвшөөрөл: хууль ёсны эрхтэй кино л байршуулна.
- Үнэгүй үйлчилгээний квот давж, хэрэглээ өсвөл 0₮ баталгаатай биш.

## Хэзээ production-г шилжүүлэх вэ?

- [ ] Render Free үйлчилгээ амжилттай deploy болсон
- [ ] Нэвтрэлт, каталог, кино тоглуулалт, админ ажиллагаа шалгагдсан
- [ ] Өгөгдлийн сан, файлуудын backup баталгаажсан
- [ ] SMS/webhook болон төлбөрийн давхар бичилт байхгүй
- [ ] DNS, SSL болон гар утасны тест тэнцсэн
- [ ] Bunny орлуулах эсэхийг видео хэмжээний тооцоогоор шийдсэн
- [ ] Зөвхөн дараа нь Vercel Pro-г цуцална

## Ашигласан албан ёсны баримтууд

- Render: https://render.com/docs/free
- Render Next.js: https://render.com/docs/deploy-nextjs-app
- Render Blueprint: https://render.com/docs/blueprint-spec
- Supabase Free: https://supabase.com/pricing
- Bunny Stream: https://bunny.net/pricing/stream/
- Cloudflare R2: https://developers.cloudflare.com/r2/pricing/
