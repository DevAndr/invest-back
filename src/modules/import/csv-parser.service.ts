import { Injectable, BadRequestException } from '@nestjs/common';

export interface ParsedProfitRecord {
  period: string; // "2024-07-01"
  quarter: number; // 1-4
  year: number;
  periodLabel: string; // "2024Q3"
  revenue: number | null;
  operatingProfit: number | null;
  ebitda: number | null;
  netProfit: number | null;
  grossProfit: number | null;
  margin: number | null;
  evEbitda: number | null;
  roe: number | null;
  pe: number | null;
}

@Injectable()
export class CsvParserService {
  parseSmartLabCsv(csvContent: string): ParsedProfitRecord[] {
    const lines = csvContent
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      throw new BadRequestException(
        'CSV пуст или содержит недостаточно данных',
      );
    }

    const headerCells = this.parseLine(lines[0]);
    const parsedPeriods = headerCells.slice(1).map((r) => this.parsePeriod(r));

    const dataMap = new Map<string, (number | null)[]>();
    for (let i = 1; i < lines.length; i++) {
      const cells = this.parseLine(lines[i]);
      const name = this.clean(cells[0] || '');
      if (!name) continue;
      dataMap.set(
        name,
        cells.slice(1).map((c) => this.parseNum(c)),
      );
    }

    const records: ParsedProfitRecord[] = [];
    for (let i = 0; i < parsedPeriods.length; i++) {
      const p = parsedPeriods[i];
      if (!p) continue;

      const revenue = this.get(dataMap, 'Выручка, млрд руб', i);
      const cost = this.get(dataMap, 'Себестоимость, млрд руб', i);
      const evEBIDA = this.get(dataMap, 'EV/EBITDA', i);
      const ROE = this.get(dataMap, 'ROE, %', i);
      const PE = this.get(dataMap, 'P/E', i);

      const record: ParsedProfitRecord = {
        period: p.iso,
        quarter: p.q,
        year: p.y,
        periodLabel: p.label,
        revenue,
        operatingProfit: this.get(dataMap, 'Операционная прибыль, млрд руб', i),
        ebitda: this.get(dataMap, 'EBITDA, млрд руб', i),
        netProfit: this.get(dataMap, 'Чистая прибыль, млрд руб', i),
        grossProfit:
          revenue !== null && cost !== null
            ? Math.round((revenue - cost) * 100) / 100
            : null,
        margin: this.get(dataMap, 'Чистая рентаб, %', i),
        evEbitda: evEBIDA,
        roe: ROE,
        pe: PE,
      };

      if (
        record.revenue !== null ||
        record.netProfit !== null ||
        record.ebitda !== null
      ) {
        records.push(record);
      }
    }

    return records;
  }

  // --- CSV line parser (separator: ;  quotes: ") ---
  private parseLine(line: string): string[] {
    const res: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if (c === ';' && !inQ) {
        res.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    res.push(cur);
    return res;
  }

  // "2024Q3" -> { y:2024, q:3, iso:"2024-07-01", label:"2024Q3" }
  private parsePeriod(
    raw: string,
  ): { y: number; q: number; iso: string; label: string } | null {
    const s = this.clean(raw);
    if (!s || s === 'LTM') return null;

    const m = s.match(/^(\d{4})Q(\d{1,2})$/);
    if (!m) {
      const ym = s.match(/^(\d{4})$/);
      if (ym) {
        const y = +ym[1];
        return { y, q: 4, iso: `${y}-10-01`, label: `${y}Q4` };
      }
      return null;
    }

    const y = +m[1],
      q = +m[2];
    if (q < 1 || q > 4) return null;
    const mo = String((q - 1) * 3 + 1).padStart(2, '0');
    return { y, q, iso: `${y}-${mo}-01`, label: s };
  }

  // "1 502" -> 1502, "47.8%" -> 47.8, "" -> null
  private parseNum(raw: string): number | null {
    if (!raw || !raw.trim()) return null;
    const s = raw
      .trim()
      .replace(/^["']|["']$/g, '')
      .replace(/\s/g, '')
      .replace(/%$/, '');
    if (s === '' || s === '-') return null;
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  private get(
    map: Map<string, (number | null)[]>,
    key: string,
    i: number,
  ): number | null {
    const exact = map.get(key);
    if (exact && i < exact.length) return exact[i];
    for (const [k, v] of map.entries()) {
      if (k.includes(key) && i < v.length) return v[i];
    }
    return null;
  }

  private clean(s: string): string {
    return s
      .trim()
      .replace(/^["']|["']$/g, '')
      .trim();
  }
}
