export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

/**
 * Canvas 智能压缩与高清渲染裁剪图像
 * 自动将尺寸缩放至 maxDimension (默认 800px)， quality 设为 0.72
 * 将体积控制在 30KB - 80KB，彻底解决 PocketBase 1MB JSON 限制
 */
export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: PixelCrop,
  maxDimension: number = 800,
  quality: number = 0.72
): Promise<{ file: File; base64: string }> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context 初始化失败');
  }

  // 计算智能等比缩放的目标像素尺寸
  let targetWidth = pixelCrop.width;
  let targetHeight = pixelCrop.height;

  if (targetWidth > maxDimension || targetHeight > maxDimension) {
    if (targetWidth >= targetHeight) {
      targetHeight = Math.round((targetHeight * maxDimension) / targetWidth);
      targetWidth = maxDimension;
    } else {
      targetWidth = Math.round((targetWidth * maxDimension) / targetHeight);
      targetHeight = maxDimension;
    }
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  // 启用高清缩放抗锯齿算法
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // 绘制图像
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight
  );

  // 导出经过高比率压缩的 Base64 与 File 对象
  return new Promise((resolve, reject) => {
    const base64 = canvas.toDataURL('image/jpeg', quality);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas 导出 Blob 失败'));
          return;
        }
        const file = new File([blob], `cropped_${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        resolve({ file, base64 });
      },
      'image/jpeg',
      quality
    );
  });
}
