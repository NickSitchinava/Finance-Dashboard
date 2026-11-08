import favicon from "../../assets/F-Dash — Logo.png";

// The favicon has an opaque black glow plate. Extract its actual FD mark at
// runtime so the mark can take the auth palette without changing the favicon.
let markPromise: Promise<string> | undefined;
export function getAuthMark(): Promise<string> {
  if (markPromise) return markPromise;
  markPromise = new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) { resolve(favicon); return; }
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const { data } = pixels;
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
          const orange = r > 165 && r > g * 1.7 && g > b * 1.4;
          const fTop = x >= 145 && x <= 580 && y >= 216 && y <= 332;
          const fStem = x >= 145 && x <= 255 && y >= 216 && y <= 752;
          const fMiddle = x >= 250 && x <= 410 && y >= 425 && y <= 530;
          const darkF = r < 95 && g < 95 && b < 100 && (fTop || fStem || fMiddle);
          data[i] = 39; data[i + 1] = 24; data[i + 2] = 126;
          data[i + 3] = orange || darkF ? 255 : 0;
        }
      }
      context.putImageData(pixels, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => resolve(favicon);
    image.src = favicon;
  });
  return markPromise;
}
