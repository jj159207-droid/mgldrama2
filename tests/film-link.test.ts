import assert from "node:assert/strict";
import {test} from "node:test";
import {filmNavigationUrl, filmShareUrl, readFilmDestination} from "../lib/film-link";

test("Facebook attribution and other parameters do not change the selected movie", () => {
  assert.deepEqual(readFilmDestination("?fbclid=example&film=34&utm_source=facebook"), {kind:"film",id:34});
  assert.deepEqual(readFilmDestination("?utm_source=facebook"), {kind:"none"});
});
test("ambiguous and malformed IDs never silently open a different movie", () => {
  for(const value of ["", "0", "-1", "1.2", "1e2", "01", "1%20", "abc", "9007199254740992", "34&film=35"]){
    assert.deepEqual(readFilmDestination(`?film=${value}`), {kind:"invalid"});
  }
});
test("copied ad URLs contain only the public film ID on the current site's origin", () => {
  assert.equal(filmShareUrl("https://customer.test/?token=private&fbclid=tracking#admin",34), "https://customer.test/?film=34");
  assert.equal(filmShareUrl("https://username:password@customer.test/",34), "https://customer.test/?film=34");
  assert.throws(()=>filmShareUrl("javascript:alert(1)",34));
  assert.throws(()=>filmShareUrl("https://customer.test",NaN));
});
test("movie navigation retains campaign attribution, replaces selection, and clears on leaving", () => {
  assert.equal(filmNavigationUrl("https://customer.test/?film=12&fbclid=tracking",34),"/?fbclid=tracking&film=34");
  assert.equal(filmNavigationUrl("https://customer.test/?film=34&utm_source=facebook",null),"/?utm_source=facebook");
  assert.throws(()=>filmNavigationUrl("https://customer.test",-2));
});
