# TAZA: сарын 0₮ hosting туршилт — Netlify Free

Төлөв: **бэлтгэл**. Production хаяг `https://taza.site` болон Vercel, Supabase, Bunny-д одоогоор өөрчлөлт ороогүй.

## Зорилго
Vercel Pro-ын ойролцоогоор $20/сар hosting зардлыг арилгахын тулд Next.js 16.3.4 сайтыг Netlify Free дээр тусад нь туршиж, **бүх үйлдэл тэнцсэн үед** үндсэн домэйныг шилжүүлэх.

## 1. Netlify Free сайт үүсгэх
1. https://app.netlify.com/ дээр GitHub-аараа нэвтэр.
2. **Add new project → Import an existing project → GitHub**.
3. `jj159207-droid/mgldrama2` репог сонго.
4. **Branch to deploy**: `infra/netlify-free-preview-20261105` (одоогийн `main` биш).
5. Build settings: `npm run build`; Publish directory: `.next`; Node 24. Энэ салбарын `netlify.toml` эдгээрийг тохируулна. **Netlify-ийн Next.js OpenNext adapter автоматаар суух тул хуучин adapter-г гараар pin хийхгүй.**
6. Үйлчилгээний багцыг **Free $0** гэдгийг баталгаажуул; нэмэлт төлбөртэй feature, Netlify Database, Blob, addon үүсгэх хэрэггүй.
7. Preview URL: `https://<таны-үүсгэсэн-үйлчилгээ>.netlify.app`. DNS-ийг одоохондоо өөрчлөхгүй.

## 2. Environment variables
Netlify: **Project configuration → Environment variables**; түлхүүрийн утгыг хэзээ ч GitHub, чат, PR-д оруулахгүй.

| Key | Утгын эх үүсвэр | Анхаарах зүйл |
| --- | --- | --- |
| `SUPABASE_URL` | Одоогийн кино сайтын Supabase URL | Киноны жинхэнэ Supabase төсөл `yigvxbivfadfgrlvzhvj`; холбогдсон Supabase эрх энэ төслийг удирдах эрхгүй. |
| `SUPABASE_SECRET_KEY` | Одоогийн server-side Supabase secret | **Нууц;** зөвхөн серверийн runtime environment. `NEXT_PUBLIC_` бүү ашигла. |
| `ADMIN_PASSWORD` | Админы хүчтэй нууц үг | Preview-д production нууц үгийг автоматаар хуулж болохгүй. |
| `SITE_URL` | Netlify-аас олгосон `https://...netlify.app` origin | Яг нэг origin; path эсвэл төгсгөлийн slash хийхгүй. |
| `SMS_WEBHOOK_SECRET`, `SMS_ALLOWED_SENDER` | Зөвхөн production шилжилтийн дараа | **Preview-д БҮҮ тохируул:** SMS webhook-ийн давхар төлбөр баталгаажуулалтаас сэргийлнэ. |

**Аюулгүй байдлын чухал нөхцөл:** Production database-тай холбосон public preview дээр бүртгэл, PIN, чат, хэтэвч, төлбөрийн POST/PUT хүсэлтүүд бодит өгөгдлийг өөрчилж болох тул эхлээд зөвхөн `/api/health` болон build-ийг шалгана. Бүрэн ажиллагааг тестлэхэд **тусдаа тест өгөгдлийн сан + тест видеонууд** эсвэл баталгаатай хаалттай, төлбөрийн SMS салгасан орчин шаардлагатай. Production DB snapshot-ыг шинэ төсөлд импортлоход хувийн мэдээллийг зохих ёсоор хамгаална; энэ баримт автоматаар өгөгдөл хуулбарлахгүй.

## 3. Тестийн дараалал
- [ ] GitHub Actions: `npm ci`, `npm run typecheck`, `npm test`, `npm run test:ui`, `npm run build` тэнцсэн.
- [ ] Netlify build амжилттай; `/api/health` нь `ok: true`.
- [ ] Фронт, зураг, гар утасны харагдац.
- [ ] Тусгаарласан тестийн өгөгдөлтэй PIN нэвтрэлт, guest session, админ эрх.
- [ ] Киноны 72 цагийн эрх, мөнгөний урсгал/буцаалт/баталгаажуулалтын идемпотент байдал.
- [ ] Bunny URL, видео тоглуулах, trailer/poster (FFmpeg-тэй замыг тусад нь).
- [ ] SMS webhook тест нь бодит гүйлгээ үүсгэхгүй.
- [ ] Netlify хэрэглээний тооцоо Free 300 кредитээс хэтрэхгүй.
- [ ] DNS/HTTPS, `SITE_URL`, cookie/Origin, admin readiness-ийн шалгалт.
- [ ] Шилжүүлсний дараа ч хэрэглэгчид кино тоглуулж чадна; Vercel буцах хувилбар бэлэн.

Netlify default Functions RAM 1024 MB, синхрон timeout 60 секунд, payload 6 MB (binary base64 үед бодит лимит бага). **`/api/trailers` FFmpeg** одоогийн Next.js кодонд 180 секунд хүртэл тооцсон, тиймээс Netlify дээр яг адил ажиллана гэж үзэж болохгүй; эхлээд бодит тест хийнэ. Удаан clip encode бол function-г тусад нь шилжүүлэх буюу админ зориулалтын урьдчилан бэлдсэн трейлэр оруулах шийдэл шаардлагатай.

## 4. Төлбөр ба бусад үйлчилгээ
- Netlify Free: **$0/сар, 300 кредит/сар**; хэтэрвэл сайт түр зогсоно; автоматаар төлбөр нэмэгдэхгүй. Production deploy 15 кредит, Netlify bandwidth 20 кредит/GB, web request 2 кредит / 10,000. Нэг платформ дахь бусад сайтууд мөн кредитээс хуваалцана.
- Vercel Pro: өмнө сарын лицензийн тооцоо **~$20**; Netlify амжилттай ажиллаж, DNS болон webhook зөв болсон үед л цуцална.
- Supabase: кино төслийн жинхэнэ аккаунтын багцыг шалгаагүй. Free 500 MB database, 1 GB object storage, 5 GB egress; идэвхгүй төсөл paused болох эрсдэлтэй. **Нөгөө `achilt` төслийг хөндөхгүй.**
- Bunny Stream: video hosting/streaming төлбөртэй. Киноны нийт хэмжээ, чанарын хувилбарууд, bandwidth, лицензийг хэмжээгүйгээр цуцлахгүй; R2 Standard-ийн 10 GB free нь бүх кино багтана гэсэн үг биш, мөн R2-д Bunny шиг transcoding байхгүй.
- `taza.site` домэйн 2027-09-15-ны орчим хүртэл бүртгэлтэй, auto-renew одоогоор унтраалттай. Ирээдүйд домэйн сунгах нь үнэгүй биш.
- GitHub public repo, сарын зардалгүй энгийн боломжуудыг хэвээр ашиглана.
- MacroDroid, SIM болон SMS үйлчилгээ нь тусдаа төлбөрийн эх үүсвэр байж болно.

## 5. Шилжүүлэх / цуцлах нөхцөл
**Бүх тест амжилттай болсны дараа л** Netlify дээр `taza.site` домэйныг нэмэн DNS-ийг өөрчилнө; SSL баталгаажуулж, SNS webhook/MacroDroid тохируулгыг нэг сервер рүү зааж, хуучин Vercel-ээр давхар баталгаажуулалт хийгдэхгүйг шалгана. Сайтын DNS-г шилжүүлэх нь Vercel Pro багцыг автоматаар цуцлахгүй; тусад нь billing settings-ээр зогсооно.

## Албан эх сурвалж
- https://www.netlify.com/pricing/
- https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/
- https://docs.netlify.com/build/functions/configuration/
- https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/
- https://supabase.com/pricing
- https://developers.cloudflare.com/r2/pricing/
