// The printable batch record: a vessel (or one of its ferments) as an HTML page
// that becomes a PDF. Pure. Everything the winemaker typed is escaped, and the
// report only restates the records, as entered: no judgement, no advice.
import type { ExportEntry } from './exportCsv';
import { fermentDay, type FermentLike } from './fermentCurves';
import { formatDate, formatEntryTime, formatItemValue, formatLiters, formatWine } from './format';
import { getLang, itemName, strings } from './i18n';
import { latestValues } from './latestValues';
import type { VesselKind } from './vesselKinds';

export type ReportVessel = {
  name: string;
  kind: VesselKind;
  variety: string | null;
  vintage: number | null;
  volumeLiters: number;
};

/** HTML-escapes text from the records. */
export function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const STYLE = `
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Georgian", Arial, sans-serif; color: #241A17; margin: 0; padding: 24px; font-size: 13px; line-height: 1.45; }
  h1 { font-size: 22px; margin: 0 0 2px; color: #4A1322; }
  h2 { font-size: 15px; margin: 22px 0 6px; color: #4A1322; border-bottom: 2px solid #C9A46A; padding-bottom: 3px; }
  .sub { color: #6B5B53; margin: 0 0 14px; }
  .facts { display: grid; grid-template-columns: max-content 1fr; gap: 3px 14px; margin: 0; }
  .facts dt { color: #6B5B53; }
  .facts dd { margin: 0; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th { text-align: left; font-size: 11px; color: #6B5B53; border-bottom: 1px solid #C9BBA9; padding: 4px 6px 4px 0; }
  td { vertical-align: top; padding: 5px 8px 5px 0; border-bottom: 1px solid #EDE3D4; }
  tr { page-break-inside: avoid; }
  .when { white-space: nowrap; }
  .said { color: #6B5B53; font-style: italic; }
  .foot { margin-top: 26px; color: #6B5B53; font-size: 11px; }
`;

/**
 * One page for the whole vessel (`ferment` null) or for one ferment: facts, the
 * latest value of each measurement, and every entry, oldest first.
 */
export function buildReportHtml(input: {
  vessel: ReportVessel;
  ferment: FermentLike | null;
  entries: readonly ExportEntry[];
  now?: Date;
}): string {
  const t = strings();
  const now = input.now ?? new Date();
  const { vessel, ferment } = input;
  const entries = [...input.entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const facts: [string, string][] = [
    [t.report.vessel, `${t.vesselKinds[vessel.kind]} · ${vessel.name}`],
    [t.report.volume, formatLiters(vessel.volumeLiters)],
  ];
  const wine = formatWine(vessel.variety, vessel.vintage);
  if (wine) facts.push([t.report.wine, wine]);
  if (ferment) {
    const end = ferment.endedAt ?? now.toISOString();
    facts.push([t.report.ferment, ferment.name]);
    facts.push([
      t.report.period,
      `${formatDate(ferment.startedAt, now)} – ${ferment.endedAt ? formatDate(ferment.endedAt, now) : t.ferment.running}`,
    ]);
    facts.push([t.report.duration, t.ferment.dayCount(fermentDay(ferment.startedAt, end))]);
  }
  facts.push([t.report.entries, String(entries.length)]);

  const latest = latestValues(entries);
  const latestRows = latest
    .map(
      ({ item, createdAt }) =>
        `<tr><td>${esc(itemName(item.name))}</td><td><b>${esc(formatItemValue(item))}</b></td><td class="when">${esc(formatEntryTime(createdAt, now))}</td></tr>`,
    )
    .join('');

  const entryRows = entries
    .map((entry) => {
      const values = entry.parsed.items.map((item) => `${itemName(item.name)} ${formatItemValue(item)}`).join(' · ');
      const note = entry.parsed.note ?? '';
      const said = entry.rawText.trim() !== '' && entry.rawText.trim() !== note.trim() ? entry.rawText : '';
      const day = ferment ? ` · ${esc(t.report.dayShort(fermentDay(ferment.startedAt, entry.createdAt)))}` : '';
      return `<tr>
        <td class="when">${esc(formatEntryTime(entry.createdAt, now))}${day}</td>
        <td>${esc(t.entryTypes[entry.type])}</td>
        <td>${esc(values)}</td>
        <td>${esc(note)}${said ? `<div class="said">“${esc(said)}”</div>` : ''}</td>
      </tr>`;
    })
    .join('');

  const title = ferment ? `${vessel.name} · ${ferment.name}` : vessel.name;
  return `<!doctype html>
<html lang="${getLang()}">
<head>
<meta charset="utf-8">
<title>${esc(t.report.title)} · ${esc(title)}</title>
<style>${STYLE}</style>
</head>
<body>
  <h1>${esc(t.report.title)}</h1>
  <p class="sub">${esc(title)}</p>
  <dl class="facts">${facts.map(([label, value]) => `<dt>${esc(label)}</dt><dd>${esc(value)}</dd>`).join('')}</dl>
  ${
    latestRows
      ? `<h2>${esc(t.latest.title)}</h2><table><thead><tr><th></th><th></th><th></th></tr></thead><tbody>${latestRows}</tbody></table>`
      : ''
  }
  <h2>${esc(t.report.timeline)}</h2>
  ${
    entryRows
      ? `<table><thead><tr><th>${esc(t.report.colTime)}</th><th>${esc(t.report.colType)}</th><th>${esc(t.report.colValues)}</th><th>${esc(t.report.colNote)}</th></tr></thead><tbody>${entryRows}</tbody></table>`
      : `<p>${esc(t.report.empty)}</p>`
  }
  <p class="foot">${esc(t.report.footer(formatDate(now.toISOString(), now)))}</p>
</body>
</html>`;
}

/** "Tank 12" or "Tank 12 · Saperavi 2026": names the PDF and its share sheet. */
export function reportTitle(vesselName: string, fermentName: string | null): string {
  return fermentName ? `${vesselName} · ${fermentName}` : vesselName;
}
