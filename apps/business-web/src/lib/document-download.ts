export function requireHttpDownloadUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('The document service returned an unsupported download URL.');
  }
  return url.toString();
}
