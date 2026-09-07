export type TabType = 'recipe' | 'prep' | 'record';
export type TargetUser = 'adult' | 'baby';

export interface Ingredient {
  name: string;
  amount: string;
  checked?: boolean;
}

export interface RecipeStepDetail {
  content: string;
  image?: string;
}

// 严格遵循 PocketBase 的集合字段结构
export interface RecipeRecord {
  id: string;
  name: string;
  target_user: TargetUser;
  category: string;
  thumbnail: string; // URL 或 SVG/Emoji 表现
  cover_image?: string; // PocketBase 上传保存的真实物理文件名
  step_images?: string[]; // PocketBase 上传保存的所有步骤物理文件名列表
  tag?: string;
  calorie_density?: number;
  is_favorite?: boolean;
  ingredients: string | Ingredient[];
  steps?: (string | RecipeStepDetail)[];
  created: string;
  updated: string;
}

export interface CookingDishSnapshot {
  id: string;
  name: string;
  thumbnail: string;
  target_user: TargetUser;
}

export interface CookingRecord {
  id: string;
  date: string; // YYYY-MM-DD
  dishes: CookingDishSnapshot[];
  rating: number; // 1-5
  note?: string;
  created: string;
  updated?: string;
}

export interface PantryItem {
  id: string;
  name: string;
  amount?: string;
  ingredient_ref?: string;
  created?: string;
  updated?: string;
}

