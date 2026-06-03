import PDFDocument from 'pdfkit';

type TrafficRow = {
  date: string;
  sessions: number;
  users: number;
  pageviews: number;
  clicks: number;
  impressions: number;
};

type KeywordRow = {
  keyword: string;
  url: string | null;
  position: number | null;
  searchVolume: number | null;
  channel: string | null | undefined;
};

function docToBuffer(doc: InstanceType<typeof PDFDocument>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

export async function buildTrafficPdf(rows: TrafficRow[], days: number): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  const bufferPromise = docToBuffer(doc);

  doc.fontSize(18).text('Báo cáo Traffic — Be Traffic', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#555').text(`Khoảng: ${days} ngày · ${new Date().toLocaleString('vi-VN')}`, {
    align: 'center',
  });
  doc.moveDown(1.5);
  doc.fillColor('#000').fontSize(9);

  const header = 'Ngày          Sessions  Users  Pageviews  Clicks  Impressions';
  doc.text(header);
  doc.moveDown(0.3);

  for (const r of rows) {
    const line = `${r.date.padEnd(14)}${String(r.sessions).padStart(8)}  ${String(r.users).padStart(5)}  ${String(r.pageviews).padStart(9)}  ${String(r.clicks).padStart(6)}  ${String(r.impressions).padStart(11)}`;
    doc.text(line);
  }

  if (rows.length === 0) {
    doc.text('(Không có dữ liệu — đồng bộ GA4/GSC trước)');
  }

  doc.end();
  return bufferPromise;
}

export async function buildKeywordsPdf(rows: KeywordRow[]): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  const bufferPromise = docToBuffer(doc);

  doc.fontSize(18).text('Báo cáo Từ khóa — Be Traffic', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#555').text(new Date().toLocaleString('vi-VN'), { align: 'center' });
  doc.moveDown(1.5);
  doc.fillColor('#000').fontSize(8);

  for (const r of rows) {
    doc.text(
      `${r.keyword} | pos: ${r.position ?? '—'} | vol: ${r.searchVolume ?? '—'} | ${r.channel ?? '—'}`
    );
    if (r.url) doc.fillColor('#666').text(`  ${r.url}`).fillColor('#000');
    doc.moveDown(0.2);
  }

  if (rows.length === 0) doc.text('(Chưa có từ khóa)');

  doc.end();
  return bufferPromise;
}
