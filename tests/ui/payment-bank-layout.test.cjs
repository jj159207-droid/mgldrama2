const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const source = readFileSync(join(__dirname, "../../app/page.tsx"), "utf8");
const checkSource = source.slice(source.indexOf("const checkout = <>"), source.indexOf("return inline ? <div", source.indexOf("const checkout = <>")));

test("simple TAZA mobile checkout puts IBAN above the account and reference", () => {
  const iban = checkSource.indexOf('wallet-single-iban');
  const account = checkSource.indexOf('wallet-single-account');
  const reference = checkSource.indexOf('wallet-single-copy wallet-single-ref');
  assert.ok(iban > 0 && account > iban && reference > account, "IBAN -> account -> transfer reference");
  assert.match(checkSource, /copyText\(tazaTransfer\?"44000500":transferDestination,tazaTransfer\?"iban":"account"\)/);
  assert.match(checkSource, /copyText\(bankAccount\.number,"account"\)/);
  assert.match(checkSource, /copyText\(refCode,"ref"\)/);
});

test("standard payment form has two independent copy buttons, IBAN first", () => {
  const bankSection = checkSource.slice(checkSource.indexOf('<section className="bank-details">'));
  const iban = bankSection.indexOf('copy-iban');
  const account = bankSection.indexOf('copy-bank-number');
  const reference = bankSection.indexOf('className="copy-reference"');
  assert.ok(iban > 0 && account > iban && reference > account);
  assert.match(bankSection, /copyText\(bankAccount\.number,"account"\)/);
});

test("IBAN is copied without display spaces and both numbers must agree", () => {
  assert.match(source, /transferIbanDisplay=tazaTransfer\?"44000500"/);
  assert.match(source, /transferIban\.endsWith\(bankAccount\.number\)/);
  assert.match(source, /disabled=\{!transferReady\|\|!orderReady\}/);
});
