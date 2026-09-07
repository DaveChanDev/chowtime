import { pb, POCKETBASE_URL } from '../lib/pocketbase';
import type { RecipeRecord } from '../types';

/**
 * 获取菜品封面缩略图的真实可读地址或 Emoji (优先读取 pb.files.getUrl 物理文件)
 */
export const getRecipeThumbnailUrl = (recipe?: RecipeRecord | null): { isImage: boolean; value: string } => {
  if (!recipe) {
    return { isImage: false, value: '🍳' };
  }

  // 1. 优先读取 PocketBase cover_image 物理存储文件
  if (recipe.cover_image && recipe.cover_image.trim() !== '') {
    try {
      const fileUrl = pb.files.getUrl(recipe, recipe.cover_image);
      return { isImage: true, value: fileUrl };
    } catch {
      return { isImage: true, value: `${POCKETBASE_URL}/api/files/recipes/${recipe.id}/${recipe.cover_image}` };
    }
  }

  // 2. 降级检查 thumbnail 字段
  if (recipe.thumbnail && recipe.thumbnail.trim() !== '') {
    const thumb = recipe.thumbnail.trim();

    if (thumb.startsWith('http') || thumb.startsWith('data:image')) {
      return { isImage: true, value: thumb };
    }

    if (/\.(jpg|jpeg|png|webp|gif|svg)$/i.test(thumb)) {
      try {
        const fileUrl = pb.files.getUrl(recipe, thumb);
        return { isImage: true, value: fileUrl };
      } catch {
        return { isImage: true, value: `${POCKETBASE_URL}/api/files/recipes/${recipe.id}/${thumb}` };
      }
    }

    return { isImage: false, value: thumb };
  }

  // 3. 默认回退 Emoji
  return {
    isImage: false,
    value: recipe.target_user === 'baby' ? '🥣' : '🍳',
  };
};

/**
 * 解析烹饪步骤图片的物理 URL (支持 step_images 数组索引映射、pb.files.getUrl 与 Base64 / URL)
 */
export const getStepImageUrl = (
  recipe?: RecipeRecord | null,
  stepItem?: string | { content?: string; image?: string; image_index?: number }
): string | null => {
  if (!stepItem) return null;

  if (typeof stepItem === 'string') {
    return null;
  }

  // 1. 优先使用映射索引从 recipe.step_images 数组中获取物理存储文件
  if (
    typeof stepItem.image_index === 'number' &&
    recipe &&
    Array.isArray(recipe.step_images) &&
    recipe.step_images[stepItem.image_index]
  ) {
    const fileName = recipe.step_images[stepItem.image_index];
    try {
      return pb.files.getUrl(recipe, fileName);
    } catch {
      return `${POCKETBASE_URL}/api/files/recipes/${recipe.id}/${fileName}`;
    }
  }

  // 2. 兼容传统的 image 属性解析
  const imgStr = stepItem.image?.trim();
  if (!imgStr) return null;

  if (imgStr.startsWith('http') || imgStr.startsWith('data:image')) {
    return imgStr;
  }

  if (recipe && /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(imgStr)) {
    try {
      return pb.files.getUrl(recipe, imgStr);
    } catch {
      return `${POCKETBASE_URL}/api/files/recipes/${recipe.id}/${imgStr}`;
    }
  }

  return imgStr;
};
