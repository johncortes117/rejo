const maximumImageSide = 768;
const maximumSourceSize = 15 * 1024 * 1024;

const readAsDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(new Error("No se pudo leer la foto."));
  reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("No se pudo leer la foto."));
  reader.readAsDataURL(file);
});

const loadImage = (source: string): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const image = new Image();
  image.onerror = () => reject(new Error("No se pudo preparar la foto. Prueba con otra imagen."));
  image.onload = () => resolve(image);
  image.src = source;
});

export const prepareAnimalPhoto = async (file: File): Promise<string> => {
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error("Elige una imagen de la cámara o de la galería.");
  }
  if (file.size > maximumSourceSize) {
    throw new Error("La foto es demasiado grande. Toma otra foto o elige una más liviana.");
  }

  const source = await readAsDataUrl(file);
  const image = await loadImage(source);
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error("No se pudo preparar la foto. Prueba con otra imagen.");
  }
  const scale = Math.min(1, maximumImageSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("No se pudo preparar la foto en este teléfono.");
  }
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.72);
};
