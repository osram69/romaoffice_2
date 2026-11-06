import test from "node:test";
import assert from "node:assert/strict";
import { formatContabDate, toContabFileDto, toContabSectionDto, toContabSettingsSectionDto } from "@/lib/contab-dto";
import type { ContabFileRow, ContabSectionRow } from "@/lib/contab-data";

const STORED = "123e4567-e89b-42d3-a456-426614174000";

function row(over: Partial<ContabFileRow> = {}): ContabFileRow {
  return {
    id: 7,
    sectionId: 3,
    originalName: "fattura.pdf",
    mime: "application/pdf",
    sizeBytes: 440402,
    storedName: STORED,
    uploadedBy: "zz-test-admin",
    uploadedAt: new Date("2026-11-06T09:30:00.000Z"),
    lastDownloadAt: null,
    ...over,
  };
}

test("file DTO carries exactly id, originalName, sizeBytes, uploadedAt and lastDownloadAt", () => {
  const dto = toContabFileDto(row({ lastDownloadAt: new Date("2026-11-07T08:00:00.000Z") }));
  assert.deepEqual(dto, {
    id: 7,
    originalName: "fattura.pdf",
    sizeBytes: 440402,
    uploadedAt: "2026-11-06T09:30:00.000Z",
    lastDownloadAt: "2026-11-07T08:00:00.000Z",
  });
  assert.deepEqual(Object.keys(dto).sort(), ["id", "lastDownloadAt", "originalName", "sizeBytes", "uploadedAt"]);
});

test("file DTO: storedName (and every other server field) is absent, also from the serialised form", () => {
  const dto = toContabFileDto(row());
  assert.equal(dto.lastDownloadAt, null);
  assert.ok(!("storedName" in dto));
  assert.ok(!("mime" in dto) && !("uploadedBy" in dto) && !("sectionId" in dto));
  assert.ok(!JSON.stringify(dto).includes(STORED));
  assert.ok(!JSON.stringify(dto).includes("storedName"));
});

test("section DTO maps every file through the file DTO and drops sortOrder", () => {
  const section: ContabSectionRow = { id: 3, title: "1° trimestre 2026", sortOrder: 9, files: [row(), row({ id: 8, storedName: "223e4567-e89b-42d3-a456-426614174000" })] };
  const dto = toContabSectionDto(section);
  assert.deepEqual(Object.keys(dto).sort(), ["files", "id", "title"]);
  assert.equal(dto.files.length, 2);
  const json = JSON.stringify(dto);
  assert.ok(!json.includes("storedName") && !json.includes(STORED) && !json.includes("223e4567"));
});

test("settings section DTO has only id, title and the file count", () => {
  const section: ContabSectionRow = { id: 3, title: "Fatture", sortOrder: 1, files: [row(), row({ id: 8 })] };
  assert.deepEqual(toContabSettingsSectionDto(section), { id: 3, title: "Fatture", fileCount: 2 });
});

test("formatContabDate shows an Italian date and time in Rome time, and nothing for null", () => {
  assert.match(formatContabDate("2026-11-06T09:30:00.000Z"), /06\/11\/2026.*10:30/);
  assert.match(formatContabDate("2026-07-06T09:30:00.000Z"), /06\/07\/2026.*11:30/);
  assert.equal(formatContabDate(null), "");
  assert.equal(formatContabDate("not a date"), "");
});
