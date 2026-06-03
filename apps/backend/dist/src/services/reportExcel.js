"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSpreadsheetXml = buildSpreadsheetXml;
function escapeXml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
/** Excel 2003 XML — mở được trong Excel/LibreOffice, không cần thư viện ngoài */
function buildSpreadsheetXml(headers, rows) {
    const headerRow = '<Row>' +
        headers.map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join('') +
        '</Row>';
    const dataRows = rows
        .map((row) => {
        const cells = row
            .map((cell) => {
            const v = cell ?? '';
            const type = typeof v === 'number' ? 'Number' : 'String';
            return `<Cell><Data ss:Type="${type}">${escapeXml(String(v))}</Data></Cell>`;
        })
            .join('');
        return `<Row>${cells}</Row>`;
    })
        .join('');
    return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Report">
<Table>
${headerRow}
${dataRows}
</Table>
</Worksheet>
</Workbook>`;
}
