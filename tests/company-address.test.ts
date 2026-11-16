import test from "node:test";
import assert from "node:assert/strict";
import { formatCompanyAddress } from "@/lib/request";

test("the current address is one line with postal code, city and country", () => {
  assert.equal(formatCompanyAddress({ companyAddress: "Via Roma 1", companyCap: "00185", companyCity: "Roma", companyCountry: "Italia" }), "Via Roma 1, 00185 Roma, Italia");
});

test("parts left empty are skipped", () => {
  assert.equal(formatCompanyAddress({ companyAddress: "Via Roma 1", companyCap: "", companyCity: "Roma", companyCountry: "" }), "Via Roma 1, Roma");
  assert.equal(formatCompanyAddress({ companyAddress: "", companyCap: "", companyCity: "", companyCountry: "" }), "");
});

test("orders saved before these fields existed still format", () => {
  assert.equal(formatCompanyAddress({ companyAddress: "Via Roma 1" }), "Via Roma 1");
});
