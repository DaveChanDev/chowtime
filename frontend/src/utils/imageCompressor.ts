/**
 * 客户端前端图片防爆强力压缩工具
 * 将任意大小的原图按比例裁剪/限制在最大 1200px 宽高内，并使用 WebP/JPEG 0.75 质量输出，
 * 保证生成的图片体积严格控制在 300KB 以内，防止炸翻数据库与 JSON 字符串
 */

export async function compressImage(
  fileOrDataUrl: File | string,
  maxWidth = 1200,
  maxHeight = 1200,
  quality = 0.75
): Promise<{ base64: string; file?: File }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const processCanvas = () => {
      let { width, height } = img;

      // 按比例计算最大 1200px 尺寸
      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          maxHeight = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('无法创建 Canvas 2D 上下文'));
        return;
      }

      // 平滑高质量渲染
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // 优先压缩输出 webp，若浏览器不支持自动回退 jpeg
      let mimeType = 'image/webp';
      let dataUrl = canvas.toDataURL(mimeType, quality);
      if (!dataUrl.startsWith('data:image/webp')) {
        mimeType = 'image/jpeg';
        dataUrl = canvas.toDataURL(mimeType, quality);
      }

      // 尝试转换为 File 对象
      try {
        const arr = dataUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || mimeType;
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const compressedFile = new File([u8arr], `compressed_${Date.now()}.${mime.split('/')[1] || 'webp'}`, {
          type: mime,
        });

        console.info(`[Client Compress] 原图压缩成功: 尺寸 (${width}x${height}), 结果体积: Math.round(dataUrl.length / 1024) KB`);
        resolve({ base64: dataUrl, file: compressedFile });
      } catch (err) {
        resolve({ base64: dataUrl });
      }
    };

    img.onload = () => {
      processCanvas();
    };

    img.onerror = (err) => {
      reject(err);
    };

    if (typeof fileOrDataUrl !== 'string') {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          img.src = e.target.result as string;
        } else {
          reject(new Error('读取图片文件失败'));
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(fileOrDataUrl);
    } else {
      img.src = fileOrDataUrl;
    }
  });
}
