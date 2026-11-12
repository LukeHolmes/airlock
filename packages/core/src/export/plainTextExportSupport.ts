import path from 'node:path';

const PLAIN_TEXT_HOST_SUFFIXES = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.dot',
  '.dotx',
  '.odt',
  '.ott',
  '.rtf',
  '.ppt',
  '.pptx',
  '.odp',
  '.xls',
  '.xlsx',
  '.ods',
  '.csv',
  '.txt',
  '.md',
  '.html',
  '.htm',
  '.xml',
  '.json',
  '.log',
]);

export function isPlainTextExportSupported(hostFilePath: string): boolean {
  const ext = path.extname(hostFilePath).toLowerCase();
  return PLAIN_TEXT_HOST_SUFFIXES.has(ext);
}
