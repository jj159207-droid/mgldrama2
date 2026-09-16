TAZA SITE MASTER — ПЛАШ ДЭЭР АШИГЛАХ ЗААВАР
================================================

ЭНЭ MASTER НЬ PRODUCTION ТАЗА САЙТТАЙ ХОЛБОГДОХГҮЙ.
Шинэ клиент бүрт GitHub, Supabase, Vercel, SMS secret, database тусдаа үүснэ.

ХЭРЭГЛЭХДЭЭ
1. Энэ бүх MASTER хавтсыг плашинд хуулна.
2. Клиентийн Windows 10/11 компьютерт хавтсыг бүхлээр нь хуулна.
3. START-HERE.cmd дээр 2 дарна.
4. Эхний цонхонд сайтын нэр, банкны данс, SMS илгээгчийг оруулна.
5. Browser нээгдэх үед ЗӨВХӨН ТУХАЙН КЛИЕНТИЙН GitHub / Supabase / Vercel аккаунтаар нэвтэрнэ.
6. Суулгац дуусмагц C:\TAZA-CLIENTS\<төслийн-нэр>\OUTPUT хавтас нээгдэнэ.
7. OUTPUT дахь MacroDroid .mdr файлыг клиентийн Android утсанд import хийнэ.
8. NEXT-STEPS.txt-ийг дагаж офлайн тест хийнэ.
9. CLIENT-RECOVERY.txt-г клиентэд өгнө. Үүнийг өөрийн плаш дээр бүү хадгал.

СУУЛГАЦ ӨӨРӨӨ ХИЙХ ЗҮЙЛС
- Git / Node.js / GitHub CLI байхгүй бол winget-ээр суулгана.
- Клиентийн private GitHub repo үүсгээд кодыг push хийнэ.
- Шинэ Supabase project үүсгэнэ.
- Шинэ database schema, storage, chat, trailer bucket, 30 хоногийн cleanup үүсгэнэ.
- Шинэ ADMIN_PASSWORD, SMS_WEBHOOK_SECRET, database password үүсгэнэ.
- Vercel project үүсгэж GitHub repo-г холбоно.
- Vercel Environment Variables тохируулж production deploy хийнэ.
- Клиент тус бүрийн endpoint + secret-тэй MacroDroid backup үүсгэнэ.
- /api/health, /api/settings, /api/catalog, /api/sms-ийг шалгана.

АНХААР
- Кино, хэрэглэгч, төлбөрийн хуучин мэдээлэл шинэ клиент рүү хуулдаггүй.
- Production ТАЗА САЙТ-ийн Supabase/Vercel/SMS secret-ийг энэ MASTER дотор хадгалдаггүй.
- GitHub repo-г private үүсгэнэ.
- MacroDroid backup болон CLIENT-RECOVERY.txt дотор тухайн КЛИЕНТИЙН secret орно. Зөвхөн клиент хадгална.
- Custom domain оруулсан ч DNS баталгаажтал SITE_URL нь Vercel production URL хэвээр байна. DNS холбогдсоны дараа NEXT-STEPS.txt-ийн заавраар сольж deploy хийнэ.
- Кино/видео контентын түгээх эрхийг клиент өөрөө хариуцна.

Хэрэв аль нэг алхам улаан алдаа өгвөл цонхоо хаалгүй алдааны зураг авч шалгана. Production сайт өөрчлөгдөхгүй.
