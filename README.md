# Кино сайт — 2026-09-12.1

Одоогийн төсөлдөө суулгах болон HTTPS-д бэлдэх үндсэн заавар: **HTTPS-READY-MN.md**.

- **AUDIT-HTTPS-MN.md** — олдсон асуудал, засвар, шалгалтын үр дүн, үлдсэн ажил.
- **POSTER-SETUP-MN.md** — зураг оруулах, SQL, өмнөх base64 зургуудыг шилжүүлэх.
- **supabase/HTTPS-UPGRADE.sql** — өмнөх reviewed өгөгдлийн санд нэмэх шинэчлэлт.
- **SHA256SUMS.txt** — энэ багцын файлуудын SHA-256 жагсаалт.

Багцын нэг баннер, долоон сонголт, хоцорсон SMS-ийн засвар хадгалагдсан. Админы зураг оруулах шинэ үйлдэл киноны постерт хамаарна; баннерын зураг оруулалт нэмээгүй.

Төслийн үндсэн хавтсанд `npm install`, `npm test`, `npm run build`, `npm run typecheck` ажиллуулна. Шинэ хоосон Supabase төсөлд эхлээд `supabase/review-install.sql`, дараа нь `supabase/HTTPS-UPGRADE.sql` шаардлагатай. Нууц тохиргоогоо зөвхөн өөрийн `.env.local` эсвэл hosting environment хэсэгт хадгална.

Бодит HTTPS домэйн, сертификат, Supabase SQL суулгалтыг энэ багц өөрөө ажиллуулахгүй. `npm run lint` хуучин `app/page.tsx`-ийн зөрчлөөс болж тэнцэхгүй; тайланд тоо, хүрээг тэмдэглэсэн.

`REVIEW-MN.md`, `INSTALL-REVIEW-MN.md`, `SMS-DELAY-MN.md`, `BANNER-UPDATE-MN.txt` нь өмнөх хувилбарын тайлбар. Хуучин суулгах алхам, hash-ийг энэ багцтай бүү холь. Одоо **HTTPS-READY-MN.md**-ийг дагана. INSTALL.cmd шаардлагагүй.
