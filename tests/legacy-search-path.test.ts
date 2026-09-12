import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';

test('legacy search paths prevent temporary-table shadowing and preserve bodies and grants', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`
      create role anon; create role authenticated; create role service_role;
      create table public.films(id bigint, cat text);
      insert into public.films values (1, 'public');
      create function public.get_film_cats() returns table(id bigint, cat text)
        language sql security definer as $$select id, cat from films;$$;
      create function public.update_film_cat(film_id bigint, new_cat text) returns void
        language sql security definer as $$update films set cat=new_cat where id=film_id;$$;
      create function public.confirm_payment(p_ref_code text) returns void
        language plpgsql security definer as $$begin
          update pending_payments set status='confirmed', confirmed_at=now() where ref_code=p_ref_code;
        end;$$;
      create function public.auto_confirm_payment() returns trigger language plpgsql
        security definer set search_path=public as $$begin return NEW; end;$$;
      revoke execute on all functions in schema public from public, anon, authenticated;
      grant execute on function public.get_film_cats(), public.update_film_cat(bigint,text) to service_role;
      create temp table films(id bigint, cat text);
      insert into pg_temp.films values (2, 'shadow');
      set search_path=pg_temp,public;
    `);
    assert.deepEqual((await pg.query('select * from public.get_film_cats()')).rows, [{ id: 2, cat: 'shadow' }]);
    const definitions = "select proname, prosrc, proacl, proowner from pg_proc where pronamespace='public'::regnamespace order by proname";
    const before = (await pg.query(definitions)).rows;
    const directory = new URL('../supabase/migrations/', import.meta.url);
    const files = (await readdir(directory)).filter(name => name.endsWith('_pin_legacy_function_search_paths.sql'));
    assert.equal(files.length, 1);
    const migration = await readFile(new URL(files[0], directory), 'utf8');
    for (let i = 0; i < 2; i++) await pg.exec(`begin;\n${migration}\ncommit;`);
    assert.deepEqual((await pg.query(definitions)).rows, before);
    assert.deepEqual((await pg.query('select * from public.get_film_cats()')).rows, [{ id: 1, cat: 'public' }]);
    await pg.query("select public.update_film_cat(1, 'updated')");
    assert.deepEqual((await pg.query('select * from public.films')).rows, [{ id: 1, cat: 'updated' }]);
    assert.deepEqual((await pg.query('select * from pg_temp.films')).rows, [{ id: 2, cat: 'shadow' }]);
    const config = await pg.query<{ proconfig: string[] }>("select proconfig from pg_proc where pronamespace='public'::regnamespace");
    assert.ok(config.rows.every(row => row.proconfig.includes('search_path=pg_catalog, public, pg_temp')));
    await pg.exec('drop function public.get_film_cats(), public.update_film_cat(bigint,text), public.confirm_payment(text), public.auto_confirm_payment();');
    await pg.exec(`begin;\n${migration}\ncommit;`); // Clean installations have no legacy functions.
  } finally {
    await pg.close();
  }
});
