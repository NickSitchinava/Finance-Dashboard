import type { Pt } from '../components/ui/Signature';

export type InvoiceSignature = { version: 1; strokes: Pt[][] };

export function normalizeSignature(value: unknown): InvoiceSignature | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Partial<InvoiceSignature>;
  if (data.version !== 1 || !Array.isArray(data.strokes)) return null;
  const strokes = data.strokes.filter((stroke): stroke is Pt[] => Array.isArray(stroke) && stroke.length > 0 && stroke.every(p =>
    p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.w) &&
    p.x >= -300 && p.x <= 600 && p.y >= -180 && p.y <= 360 && p.w > 0 && p.w <= 20,
  ));
  return strokes.length ? { version: 1, strokes } : null;
}

export function signatureBounds(signature: InvoiceSignature | null) {
  const points = signature?.strokes.flat() ?? [];
  if (!points.length) return null;
  const left = Math.max(0, Math.min(...points.map(p => p.x - p.w / 2)) - 3);
  const top = Math.max(0, Math.min(...points.map(p => p.y - p.w / 2)) - 3);
  const right = Math.min(300, Math.max(...points.map(p => p.x + p.w / 2)) + 3);
  const bottom = Math.min(180, Math.max(...points.map(p => p.y + p.w / 2)) + 3);
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

// This serializes the supplied pad's same midpoint quadratic pieces for the
// invoice preview and PDF. The interactive drawing implementation stays in Signature.
export function signatureSvg(signature: InvoiceSignature | null) {
  const bounds = signatureBounds(signature);
  if (!bounds || !signature) return null;
  const ink = signature.strokes.map(stroke => {
    if (stroke.length === 1) {
      const p = stroke[0];
      return `<circle cx="${p.x}" cy="${p.y}" r="${p.w / 2}" fill="#211b3b"/>`;
    }
    return stroke.slice(1).map((b, index) => {
      const i = index + 1;
      const a = stroke[i - 1];
      const start = i === 1 ? a : { x: (stroke[i - 2].x + a.x) / 2, y: (stroke[i - 2].y + a.y) / 2 };
      const end = i === stroke.length - 1 ? b : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      return `<path d="M${start.x.toFixed(1)} ${start.y.toFixed(1)}Q${a.x.toFixed(1)} ${a.y.toFixed(1)} ${end.x.toFixed(1)} ${end.y.toFixed(1)}" stroke-width="${((a.w + b.w) / 2).toFixed(2)}"/>`;
    }).join('');
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}" width="${bounds.width}" height="${bounds.height}" fill="none" stroke="#211b3b" stroke-linecap="round" stroke-linejoin="round">${ink}</svg>`;
}

export function signatureDataUrl(signature: InvoiceSignature | null) {
  const svg = signatureSvg(signature);
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
}

export async function signaturePng(signature: InvoiceSignature) {
  const svg = signatureSvg(signature);
  const bounds = signatureBounds(signature);
  if (!svg || !bounds) return null;
  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();
  const scale = 4;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(bounds.width * scale);
  canvas.height = Math.ceil(bounds.height * scale);
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return { data: canvas.toDataURL('image/png'), aspect: bounds.width / bounds.height };
}
