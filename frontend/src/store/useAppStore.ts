import { create } from 'zustand';
import type { RecipeRecord, TargetUser, TabType, CookingRecord, PantryItem } from '../types';
import { pb } from '../lib/pocketbase';
import { queryClient } from '../main';
import { normalizeIngredients } from '../utils/recipeHelper';

interface AppState {
  prepList: RecipeRecord[];
  checkedIngredients: Record<string, boolean>;
  cookingRecords: CookingRecord[];
  pantryList: PantryItem[];
  selectedRecipe: RecipeRecord | null;
  editingRecipe: RecipeRecord | null;

  activeTab: TabType;
  activeGroup: TargetUser;
  activeCategory: string;
  isCookingOpen: boolean;
  isAddModalOpen: boolean;
  isInspirationOpen: boolean;

  // Actions
  fetchCookingRecords: () => Promise<void>;
  addCookingRecord: (record: CookingRecord) => Promise<void>;
  updateCookingRecord: (recordId: string, updatedRecord: Partial<CookingRecord>) => Promise<void>;
  deleteCookingRecord: (recordId: string) => Promise<void>;

  fetchPantryList: () => Promise<void>;
  addToPantry: (name: string, amount?: string) => Promise<void>;
  removeFromPantry: (pantryIdOrName: string) => Promise<void>;
  togglePantry: (name: string) => Promise<void>;
  isInPantry: (name: string) => boolean;

  clearPrepList: () => void;
  toggleIngredientCheck: (key: string) => void;

  openRecipeDetail: (recipe: RecipeRecord) => void;
  closeRecipeDetail: () => void;
  deleteRecipe: (recipeId: string) => Promise<void>;

  openEditModal: (recipe: RecipeRecord) => void;
  updateRecipe: (recipeId: string, recipeData: RecipeRecord, coverFile?: File | null) => Promise<void>;

  setActiveTab: (tab: TabType) => void;
  setActiveGroup: (group: TargetUser) => void;
  setActiveCategory: (category: string) => void;
  openCooking: () => void;
  closeCooking: () => void;
  openAddModal: () => void;
  closeAddModal: () => void;
  openInspiration: () => void;
  closeInspiration: () => void;

  addRecipe: (recipe: RecipeRecord, coverFile?: File | null) => Promise<void>;
  addToPrep: (recipe: RecipeRecord) => void;
  addRecipeFromInspiration: (recipe: RecipeRecord, userIngredients?: string[]) => void;
  removeFromPrep: (recipeId: string) => void;
  togglePrep: (recipe: RecipeRecord) => void;
  isInPrep: (recipeId: string) => boolean;
}

const LOCAL_PREP_KEY = 'chowtime_prep_list';
const LOCAL_CHECKED_KEY = 'chowtime_prep_checked';
const LOCAL_RECORDS_KEY = 'chowtime_cooking_records';
const LOCAL_PANTRY_KEY = 'chowtime_pantry_list';

function loadStoredPantry(): PantryItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_PANTRY_KEY);
    return raw ? JSON.parse(raw) : [
      { id: 'p_1', name: '鸡蛋' },
      { id: 'p_2', name: '西红柿' },
      { id: 'p_3', name: '葱' },
      { id: 'p_4', name: '蒜' },
      { id: 'p_5', name: '生抽' }
    ];
  } catch {
    return [];
  }
}

function saveStoredPantry(list: PantryItem[]): void {
  try {
    localStorage.setItem(LOCAL_PANTRY_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('LocalStorage save pantry error:', err);
  }
}

function loadStoredPrepList(): RecipeRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_PREP_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePrepList(list: RecipeRecord[]): void {
  try {
    localStorage.setItem(LOCAL_PREP_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('LocalStorage save prepList error:', err);
  }
}

function loadStoredChecked(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(LOCAL_CHECKED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredChecked(checked: Record<string, boolean>): void {
  try {
    localStorage.setItem(LOCAL_CHECKED_KEY, JSON.stringify(checked));
  } catch (err) {
    console.warn('LocalStorage save checked error:', err);
  }
}

function loadStoredRecords(): CookingRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_RECORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredRecords(list: CookingRecord[]): void {
  try {
    localStorage.setItem(LOCAL_RECORDS_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('LocalStorage save records error:', err);
  }
}

function dataURLtoFile(dataurl: string, filename: string): File {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/webp';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

function buildRecipeFormData(recipeData: RecipeRecord, coverFile?: File | null): FormData {
  const formData = new FormData();
  formData.append('name', recipeData.name || '');
  formData.append('target_user', recipeData.target_user || 'adult');
  formData.append('category', recipeData.category || '荤菜');
  formData.append('tag', recipeData.tag || '');
  formData.append('is_favorite', String(Boolean(recipeData.is_favorite)));

  const ingText = typeof recipeData.ingredients === 'string'
    ? recipeData.ingredients
    : JSON.stringify(recipeData.ingredients || []);
  formData.append('ingredients', ingText);
  formData.append('thumbnail', recipeData.thumbnail || '🍳');

  if (coverFile) {
    formData.append('cover_image', coverFile);
  }

  const rawSteps = recipeData.steps || [];
  let stepImageIdx = 0;

  const processedSteps = rawSteps.map((stepItem, idx) => {
    if (typeof stepItem === 'string') {
      return { content: stepItem };
    }

    const content = stepItem.content || '';
    const image = stepItem.image;

    if (image && image.startsWith('data:image')) {
      try {
        const fileObj = dataURLtoFile(image, `step_${Date.now()}_${idx}.webp`);
        formData.append('step_images', fileObj);
        const currentIdx = stepImageIdx;
        stepImageIdx++;
        return { content, image_index: currentIdx };
      } catch (err) {
        console.warn('步骤图 base64 转文件异常:', err);
        return { content, image };
      }
    }

    return { content, image, image_index: (stepItem as any).image_index };
  });

  formData.append('steps', JSON.stringify(processedSteps));
  return formData;
}

export const useAppStore = create<AppState>((set, get) => ({
  prepList: loadStoredPrepList(),
  checkedIngredients: loadStoredChecked(),
  cookingRecords: loadStoredRecords(),
  pantryList: loadStoredPantry(),
  selectedRecipe: null,
  editingRecipe: null,

  activeTab: 'recipe',
  activeGroup: 'adult',
  activeCategory: '全部',
  isCookingOpen: false,
  isAddModalOpen: false,
  isInspirationOpen: false,

  fetchPantryList: async () => {
    try {
      const records = await pb.collection('pantry').getFullList<PantryItem>({
        sort: '-created',
      });
      if (Array.isArray(records)) {
        // 远端云端同步成功：采取“远端更高优先级”，完全覆盖更新本地缓存
        saveStoredPantry(records);
        set({ pantryList: records });
      }
    } catch (err) {
      console.warn('PocketBase pantry 远端同步离线降级 (保留现有离线缓存):', err);
    }
  },

  addToPantry: async (name, amount = '') => {
    const cleanName = name.trim();
    if (!cleanName) return;

    if (get().pantryList.some((item) => item.name.toLowerCase() === cleanName.toLowerCase())) {
      return;
    }

    const newItem: PantryItem = {
      id: `pantry_${Date.now()}`,
      name: cleanName,
      amount: amount,
    };

    // 1. 优先本地秒级应用，提升离线/弱网顺畅体验
    set((state) => {
      const nextList = [newItem, ...state.pantryList];
      saveStoredPantry(nextList);
      return { pantryList: nextList };
    });

    // 2. 后台静默同步 PocketBase
    try {
      await pb.collection('pantry').create<PantryItem>({
        name: cleanName,
        amount: amount,
      });
      await get().fetchPantryList();
    } catch (err) {
      console.warn('PocketBase pantry 写入离线静默降级:', err);
    }
  },

  removeFromPantry: async (pantryIdOrName) => {
    const stateList = get().pantryList;
    const target = stateList.find(
      (item) => item.id === pantryIdOrName || item.name.toLowerCase() === pantryIdOrName.toLowerCase()
    );

    if (target) {
      // 1. 本地优先瞬间更新
      set((state) => {
        const nextList = state.pantryList.filter((item) => item.id !== target.id);
        saveStoredPantry(nextList);
        return { pantryList: nextList };
      });

      // 2. 后台静默 API 同步
      try {
        await pb.collection('pantry').delete(target.id);
      } catch (err) {
        console.warn('PocketBase pantry 删除离线静默降级:', err);
      }
    }
  },

  togglePantry: async (name) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    if (get().isInPantry(cleanName)) {
      await get().removeFromPantry(cleanName);
    } else {
      await get().addToPantry(cleanName);
    }
  },

  isInPantry: (name) => {
    const cleanName = name.trim().toLowerCase();
    return get().pantryList.some((item) => item.name.toLowerCase() === cleanName);
  },

  fetchCookingRecords: async () => {
    try {
      const records = await pb.collection('cooking_records').getFullList<CookingRecord>({
        sort: '-date,-created',
      });
      const validRecords = records || [];
      saveStoredRecords(validRecords);
      set({ cookingRecords: validRecords });
    } catch (err) {
      console.warn('PocketBase cooking_records 交互警告 (保留离线本地缓存):', err);
      set({ cookingRecords: loadStoredRecords() });
    }
  },

  addCookingRecord: async (newRecord) => {
    try {
      const { id, ...payload } = newRecord;
      await pb.collection('cooking_records').create(payload);
      console.info('成功写入 PocketBase cooking_records 历史打卡集合！');
      await get().fetchCookingRecords();
    } catch (err: any) {
      console.warn('写入 PocketBase cooking_records 警告 (本地降级持久化保存):', err);
      set((state) => {
        const nextList = [newRecord, ...state.cookingRecords];
        saveStoredRecords(nextList);
        return { cookingRecords: nextList };
      });
    }
  },

  updateCookingRecord: async (recordId, updatedRecord) => {
    try {
      const { id, ...payload } = updatedRecord as any;
      await pb.collection('cooking_records').update(recordId, payload);
      console.info('成功更新 PocketBase cooking_records 记录:', recordId);
      await get().fetchCookingRecords();
    } catch (err) {
      console.warn('更新 PocketBase cooking_records 警告 (降级更新本地数据):', err);
      set((state) => {
        const nextList = state.cookingRecords.map((item) =>
          item.id === recordId ? ({ ...item, ...updatedRecord } as CookingRecord) : item
        );
        saveStoredRecords(nextList);
        return { cookingRecords: nextList };
      });
    }
  },

  deleteCookingRecord: async (recordId) => {
    try {
      await pb.collection('cooking_records').delete(recordId);
      console.info('成功删除 PocketBase cooking_records 记录:', recordId);
      await get().fetchCookingRecords();
    } catch (err) {
      console.warn('删除 PocketBase cooking_records 警告 (降级删除本地数据):', err);
      set((state) => {
        const nextList = state.cookingRecords.filter((item) => item.id !== recordId);
        saveStoredRecords(nextList);
        return { cookingRecords: nextList };
      });
    }
  },

  openRecipeDetail: (recipe) => set({ selectedRecipe: recipe }),
  closeRecipeDetail: () => set({ selectedRecipe: null }),

  openEditModal: (recipe) => set({ isAddModalOpen: true, editingRecipe: recipe }),

  updateRecipe: async (recipeId, recipeData, coverFile) => {
    try {
      const formData = buildRecipeFormData(recipeData, coverFile);
      const updatedRecord = await pb.collection('recipes').update<RecipeRecord>(recipeId, formData);

      console.info('成功全物理文件流更新 PocketBase 菜谱记录:', updatedRecord);
      queryClient.invalidateQueries({ queryKey: ['recipes'] });

      set({
        selectedRecipe: updatedRecord,
        editingRecipe: null,
      });
    } catch (err: any) {
      const origErr = err?.originalError || err?.data || err;
      console.error('PB Update Error:', err);
      alert('PocketBase API 更新失败！报错信息：' + (err?.message || err) + '\n详情：' + JSON.stringify(origErr));
      set({ editingRecipe: null });
    }
  },

  deleteRecipe: async (recipeId) => {
    try {
      await pb.collection('recipes').delete(recipeId);
      console.info('成功从 PocketBase 删除菜谱:', recipeId);
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    } catch (err) {
      console.warn('PocketBase 删除记录警告 (本地更新):', err);
    }

    set((state) => {
      const newList = state.prepList.filter((r) => r.id !== recipeId);
      savePrepList(newList);
      return {
        prepList: newList,
        selectedRecipe: null,
      };
    });
  },

  clearPrepList: () => {
    savePrepList([]);
    saveStoredChecked({});
    set({ prepList: [], checkedIngredients: {} });
  },

  toggleIngredientCheck: (key) =>
    set((state) => {
      const nextChecked = {
        ...state.checkedIngredients,
        [key]: !state.checkedIngredients[key],
      };
      saveStoredChecked(nextChecked);
      return { checkedIngredients: nextChecked };
    }),

  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveGroup: (group) => set({ activeGroup: group, activeCategory: '全部' }),
  setActiveCategory: (category) => set({ activeCategory: category }),
  openCooking: () => set({ isCookingOpen: true }),
  closeCooking: () => set({ isCookingOpen: false }),
  openAddModal: () => set({ isAddModalOpen: true, editingRecipe: null }),
  closeAddModal: () => set({ isAddModalOpen: false, editingRecipe: null }),
  openInspiration: () => set({ isInspirationOpen: true }),
  closeInspiration: () => set({ isInspirationOpen: false }),

  addRecipe: async (newRecipe, coverFile) => {
    try {
      const formData = buildRecipeFormData(newRecipe, coverFile);
      const createdRecord = await pb.collection('recipes').create<RecipeRecord>(formData);

      console.info('成功全物理文件流写入 PocketBase recipes 集合:', createdRecord);
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      return;
    } catch (err: any) {
      const origErr = err?.originalError || err?.data || err;
      console.error('PB Error:', err);
      alert('PocketBase API 保存失败！报错信息：' + (err?.message || err) + '\n详情：' + JSON.stringify(origErr));
    }
  },

  addToPrep: (recipe) =>
    set((state) => {
      if (state.prepList.some((item) => item.id === recipe.id)) {
        return state;
      }
      const newList = [...state.prepList, recipe];
      savePrepList(newList);
      return { prepList: newList };
    }),

  addRecipeFromInspiration: (recipe, userIngredients = []) =>
    set((state) => {
      const exists = state.prepList.some((item) => item.id === recipe.id);
      const newList = exists ? state.prepList : [...state.prepList, recipe];
      if (!exists) {
        savePrepList(newList);
      }

      // 智能采购状态穿透：比对用户在“寻味”中搜索持有的食材，将对应食材在备菜/采购清单中自动打勾 (设为无需采购)
      const nextChecked = { ...state.checkedIngredients };
      if (Array.isArray(userIngredients) && userIngredients.length > 0) {
        const normalizedRecipeIngs = normalizeIngredients(recipe.ingredients);
        const cleanUserSet = userIngredients.map((u) => u.trim().toLowerCase()).filter(Boolean);

        normalizedRecipeIngs.forEach((ing) => {
          const cleanName = ing.name
            .replace(/[\d\.\s\+\-\*\/]+/g, '')
            .replace(/(g|kg|ml|l|勺|个|块|片|根|克|千克|毫升|升|少许|适量|适度|大匙|小匙|包|头|粒|\(.*?\)|（.*?）)/gi, '')
            .trim();

          const isHit = cleanUserSet.some(
            (uItem) =>
              (cleanName && (cleanName.toLowerCase().includes(uItem) || uItem.includes(cleanName.toLowerCase()))) ||
              ing.name.toLowerCase().includes(uItem)
          );

          if (isHit) {
            nextChecked[cleanName] = true;
            nextChecked[ing.name] = true;
          }
        });
        saveStoredChecked(nextChecked);
      }

      return {
        prepList: newList,
        checkedIngredients: nextChecked,
      };
    }),

  removeFromPrep: (recipeId) =>
    set((state) => {
      const newList = state.prepList.filter((item) => item.id !== recipeId);
      savePrepList(newList);
      return { prepList: newList };
    }),

  togglePrep: (recipe) =>
    set((state) => {
      const exists = state.prepList.some((item) => item.id === recipe.id);
      const newList = exists
        ? state.prepList.filter((item) => item.id !== recipe.id)
        : [...state.prepList, recipe];
      savePrepList(newList);
      return { prepList: newList };
    }),

  isInPrep: (recipeId) => get().prepList.some((item) => item.id === recipeId),
}));
