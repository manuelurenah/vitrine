/**
 * Client-side zip + download helper for image collections. JSZip is loaded
 * dynamically so it stays out of the initial bundle — callers pay the cost
 * only when the user actually clicks "download all".
 */
export async function downloadImagesAsZip(urls: string[], baseName: string): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('downloadImagesAsZip is client-only');
  }
  if (urls.length === 0) return;

  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  await Promise.all(
    urls.map(async (url, i) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
      const blob = await res.blob();
      const ext = extensionFromMime(blob.type) ?? extensionFromUrl(url) ?? 'png';
      zip.file(`${baseName}-v${i + 1}.${ext}`, blob);
    }),
  );

  const out = await zip.generateAsync({ type: 'blob' });
  const objectUrl = URL.createObjectURL(out);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `${baseName}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

function extensionFromMime(mime: string): string | null {
  if (!mime) return null;
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
  };
  return map[mime.split(';')[0]!.trim().toLowerCase()] ?? null;
}

function extensionFromUrl(url: string): string | null {
  try {
    const path = new URL(url, 'http://x').pathname;
    const dot = path.lastIndexOf('.');
    if (dot < 0) return null;
    const ext = path.slice(dot + 1).toLowerCase();
    return /^[a-z0-9]{1,5}$/.test(ext) ? ext : null;
  } catch {
    return null;
  }
}
