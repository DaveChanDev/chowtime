import { correctIngredientLine, splitIngredientLine } from './ingredientAliasData';

export interface IngredientItem {
  name: string;
  amount: string;
}

/**
 * 智能食材解析器 (Smart Ingredients Normalizer)
 * 支持纯文本、JSON 字符串、对象数组解析，提纯名称与用量，自动别名纠偏
 */
export function normalizeIngredients(rawIngredients: any): IngredientItem[] {
  if (!rawIngredients) return [];

  let itemsToProcess: any[] = [];

  if (typeof rawIngredients === 'string') {
    const trimmed = rawIngredients.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          itemsToProcess = parsed;
        } else if (parsed && typeof parsed === 'object') {
          itemsToProcess = [parsed];
        } else {
          itemsToProcess = trimmed.split(/\r?\n/);
        }
      } catch {
        itemsToProcess = trimmed.split(/\r?\n/);
      }
    } else {
      itemsToProcess = trimmed.split(/\r?\n/);
    }
  } else if (Array.isArray(rawIngredients)) {
    itemsToProcess = rawIngredients;
  } else if (typeof rawIngredients === 'object' && rawIngredients !== null) {
    itemsToProcess = [rawIngredients];
  }

  const result: IngredientItem[] = [];

  for (const item of itemsToProcess) {
    if (!item) continue;

    if (typeof item === 'object') {
      const rawName = String(item.name || '').trim();
      const rawAmt = String(item.amount || '').trim();
      if (rawName) {
        const corrected = correctIngredientLine(rawName);
        const { name: pureName, amount: extraAmt } = splitIngredientLine(corrected);
        result.push({
          name: pureName || rawName,
          amount: rawAmt || extraAmt || '',
        });
      }
    } else if (typeof item === 'string') {
      const line = item.trim();
      if (line) {
        const correctedLine = correctIngredientLine(line);
        const { name: pureName, amount } = splitIngredientLine(correctedLine);
        if (pureName) {
          result.push({
            name: pureName,
            amount: amount || '',
          });
        }
      }
    }
  }

  return result;
}

export interface MatchResult {
  score: number; // 0 - 100
  level: 'exact' | 'easy' | 'lacking';
  levelLabel: string;
  matchedCount: number;
  totalCount: number;
  missingIngredients: IngredientItem[];
  matchedIngredients: IngredientItem[];
}

/**
 * 智能余粮算法：计算菜谱与当前冰箱已有食材的匹配度
 * 算法逻辑：匹配度 = (菜谱所需食材集合 ∩ 冰箱已有食材集合) / 菜谱所需食材总数
 * 阈值划分：
 *   - 完全匹配 (100%，直接下锅)
 *   - 轻松可做 (70%~99%，缺少许配料)
 *   - 储备不足 (<70%，推荐采购)
 */
export function calculateRecipeMatch(rawIngredients: any, pantryNames: string[]): MatchResult {
  const cleanPantrySet = new Set(
    (pantryNames || []).map((p) => p.trim().toLowerCase()).filter(Boolean)
  );

  // 拦截 1：如果没有任何余粮食材，强制返回 score = 0，绝不出 100
  if (cleanPantrySet.size === 0) {
    return {
      score: 0,
      level: 'lacking',
      levelLabel: '储备不足',
      matchedCount: 0,
      totalCount: 0,
      missingIngredients: [],
      matchedIngredients: [],
    };
  }

  const normalizedList = normalizeIngredients(rawIngredients);

  // 拦截 2：如果菜谱食材解析为空或数量为 0，强制返回 score = 0
  if (!normalizedList || normalizedList.length === 0) {
    return {
      score: 0,
      level: 'lacking',
      levelLabel: '储备不足',
      matchedCount: 0,
      totalCount: 0,
      missingIngredients: [],
      matchedIngredients: [],
    };
  }

  const matched: IngredientItem[] = [];
  const missing: IngredientItem[] = [];

  normalizedList.forEach((ing) => {
    const cleanName = ing.name
      .replace(/[\d\.\s\+\-\*\/]+/g, '')
      .replace(/(g|kg|ml|l|勺|个|块|片|根|克|千克|毫升|升|少许|适量|适度|大匙|小匙|包|头|粒|\(.*?\)|（.*?）)/gi, '')
      .trim()
      .toLowerCase();

    const isHit = Array.from(cleanPantrySet).some(
      (pantryItem) =>
        (cleanName && (cleanName.includes(pantryItem) || pantryItem.includes(cleanName))) ||
        ing.name.toLowerCase().includes(pantryItem)
    );

    if (isHit) {
      matched.push(ing);
    } else {
      missing.push(ing);
    }
  });

  const matchedCount = matched.length;
  const totalCount = normalizedList.length;

  if (totalCount === 0 || matchedCount === 0) {
    return {
      score: 0,
      level: 'lacking',
      levelLabel: '储备不足',
      matchedCount: 0,
      totalCount,
      missingIngredients: missing,
      matchedIngredients: [],
    };
  }

  const rawScore = (matchedCount / totalCount) * 100;
  const score = isNaN(rawScore) || !isFinite(rawScore) ? 0 : Math.round(rawScore);

  let level: 'exact' | 'easy' | 'lacking' = 'lacking';
  let levelLabel = '推荐采购';

  if (score === 100) {
    level = 'exact';
    levelLabel = '直接下锅';
  } else if (score >= 70) {
    level = 'easy';
    levelLabel = '轻松可做';
  } else {
    level = 'lacking';
    levelLabel = '储备不足';
  }

  return {
    score,
    level,
    levelLabel,
    matchedCount,
    totalCount,
    missingIngredients: missing,
    matchedIngredients: matched,
  };
}

export interface ShoppingItem {
  id: string;
  name: string;
  rawName: string;
  amount: string;
  category: string;
  checked?: boolean;
}

export interface StallGroup {
  category: string;
  items: ShoppingItem[];
}

export function inferStallCategory(name: string): string {
  const clean = name.trim().toLowerCase();

  // 1. 调料特例 (优先截获各类酱料、油盐酱醋、花椒/麻椒)
  if (/(鸡精|鸡粉|鸡汁|味精|花椒|胡椒|黑胡椒|白胡椒|十三香|五香粉|辣椒面|辣椒油|辣椒酱|黄豆酱|甜面酱|豆瓣酱|香辣酱|海鲜酱|番茄酱|芝麻酱|剁椒|泡椒|蚝油|生抽|老抽|酱油|料酒|香醋|陈醋|米醋|白醋|食用油|橄榄油|香油|麻油|猪油|白糖|冰糖|红糖|食盐|精盐|蒸鱼豉油)/.test(clean)) {
    return '🧂 调料副食摊';
  }

  // 2. 鲜蔬菜特例 (小米辣、尖椒、青椒、葱姜蒜等)
  if (/(尖椒|青椒|彩椒|甜椒|柿子椒|螺丝椒|线椒|大辣椒|杭椒|青辣椒|红辣椒|圆椒|小米辣|大葱|小葱|洋葱|葱段|葱花|大蒜|蒜头|蒜瓣|蒜苗|蒜苔|生姜|老姜|姜片|姜丝|细香葱|黄瓜|胡萝卜|黑木耳|木耳|包菜|大白菜|西红柿|番茄|干辣椒|茄子|土豆|青菜|香菜|西葫芦|西兰花|莴笋|金针菇|豆芽|豆豉)/.test(clean)) {
    return '🥦 蔬菜摊';
  }

  // 3. 蛋奶豆制品
  if (/(蛋|牛奶|芝士|奶酪|豆腐|鱼豆腐|豆干|腐竹|豆腐皮|豆皮|千张|素鸡)/.test(clean)) {
    return '🥚 蛋奶豆制品';
  }

  // 4. 肉类 (排除鸡精/鸡蛋后精准匹配肉禽)
  if (/(肉|猪|牛|羊|鸡|鸭|鹅|排骨|培根|火腿|腊肉|香肠|肉丸|里脊|鸡腿|鸡翅|鸡丁)/.test(clean)) {
    return '🥩 肉禽摊';
  }

  // 5. 海鲜水产
  if (/(鱼|虾|蟹|贝|海参|蚬|鱿|鲜|蛤|螺|蚝|带鱼|黄花鱼|三文鱼|鳕鱼|虾皮|虾仁)/.test(clean)) {
    return '🐟 海鲜水产摊';
  }

  // 6. 主食粮油 (包含芝麻、白芝麻、黑芝麻、花生、核桃、松子等粮油干货与主食粉丝)
  if (/(米|面|粉|麦|粮|皮|挂面|馒头|饼|贴饼|年糕|通心粉|芝麻|白芝麻|黑芝麻|花生|松子|核桃|淀粉|生粉|粉丝)/.test(clean)) {
    return '🌾 主食粮油摊';
  }

  // 7. 水果
  if (/(苹果|香蕉|柠檬|梨|桃|桔|橙|葡萄|西瓜|草莓)/.test(clean)) {
    return '🍎 水果摊';
  }

  // 8. 默认分类
  return '🥦 蔬菜摊';
}

/**
 * 极简合并与扣减算法：汇总已选菜谱所需的食材，并自动扣减冰箱余粮
 * 降级处理：同单位同数字相加；模糊单位或混合单位直接优雅拼接，绝对无 NaN
 */
export function aggregateShoppingList(
  recipes: any[],
  pantryNames: string[] = []
): StallGroup[] {
  const cleanPantrySet = new Set(
    (pantryNames || []).map((p) => p.trim().toLowerCase()).filter(Boolean)
  );

  const rawMap = new Map<string, { name: string; amounts: string[]; category: string }>();

  recipes.forEach((recipe) => {
    const ingList = normalizeIngredients(recipe.ingredients);
    ingList.forEach((ing) => {
      const cleanName = ing.name
        .replace(/[\d\.\s\+\-\*\/]+/g, '')
        .replace(/(g|kg|ml|l|勺|个|块|片|根|克|千克|毫升|升|少许|适量|适度|大匙|小匙|包|头|粒|\(.*?\)|（.*?）)/gi, '')
        .trim();

      if (!cleanName) return;

      // 1. 自动过滤厨房常备基础调味料与小料 (葱姜蒜、盐糖油酱醋、水淀粉等无需采购/准备的基础品)
      if (isCommonIngredient(cleanName)) return;

      // 2. 扣减余粮
      const isPantry = Array.from(cleanPantrySet).some(
        (p) => p && (cleanName.toLowerCase().includes(p) || p.includes(cleanName.toLowerCase()))
      );
      if (isPantry) return;

      const amtStr = ing.amount && ing.amount.trim() ? ing.amount.trim() : '适量';

      if (!rawMap.has(cleanName)) {
        rawMap.set(cleanName, {
          name: cleanName,
          amounts: [amtStr],
          category: inferStallCategory(cleanName),
        });
      } else {
        rawMap.get(cleanName)!.amounts.push(amtStr);
      }
    });
  });

  const items: ShoppingItem[] = [];
  rawMap.forEach((val, key) => {
    let mergedAmount = '';
    let sameUnit = true;
    let unit = '';
    let totalNum = 0;

    for (const a of val.amounts) {
      const match = a.match(/^([\d\.]+)\s*([a-zA-Z\u4e00-\u9fa5]+)$/);
      if (match) {
        const num = parseFloat(match[1]);
        const u = match[2];
        if (!isNaN(num) && isFinite(num) && num > 0) {
          if (!unit) {
            unit = u;
            totalNum += num;
          } else if (unit === u) {
            totalNum += num;
          } else {
            sameUnit = false;
            break;
          }
        } else {
          sameUnit = false;
          break;
        }
      } else {
        sameUnit = false;
        break;
      }
    }

    if (sameUnit && unit && !isNaN(totalNum) && isFinite(totalNum) && totalNum > 0) {
      const formattedNum = Number.isInteger(totalNum) ? totalNum.toString() : parseFloat(totalNum.toFixed(2)).toString();
      mergedAmount = `${formattedNum}${unit}`;
    } else {
      const uniqueAmts = Array.from(new Set(val.amounts));
      mergedAmount = uniqueAmts.join(', ');
    }

    items.push({
      id: `shop_${key}`,
      name: val.name,
      rawName: val.name,
      amount: mergedAmount,
      category: val.category,
      checked: false,
    });
  });

  const groupMap = new Map<string, ShoppingItem[]>();
  items.forEach((item) => {
    if (!groupMap.has(item.category)) {
      groupMap.set(item.category, []);
    }
    groupMap.get(item.category)!.push(item);
  });

  const stallOrder = ['🥦 蔬菜摊', '🥩 肉禽摊', '🐟 海鲜水产摊', '🥚 蛋奶豆制品', '🌾 主食粮油摊', '🧂 调料副食摊', '🍎 水果摊'];
  const sortedCategories = Array.from(groupMap.keys()).sort(
    (a, b) => (stallOrder.indexOf(a) !== -1 ? stallOrder.indexOf(a) : 99) - (stallOrder.indexOf(b) !== -1 ? stallOrder.indexOf(b) : 99)
  );

  return sortedCategories.map((cat) => ({
    category: cat,
    items: groupMap.get(cat)!,
  }));
}

// ==================== 寻味（看菜下饭）专属匹配引擎升级 ====================

export const COMMON_INGREDIENTS_WHITELIST: string[] = [
  // 葱姜蒜常备小料
  '葱', '姜', '蒜', '生姜', '老姜', '姜片', '姜丝', '大蒜', '蒜瓣', '蒜末', '蒜泥', '小葱', '大葱', '葱段', '小葱段', '青蒜段', '葱花', '葱姜', '葱姜蒜', '姜蒜',
  // 基础调味品
  '盐', '食盐', '精盐', '糖', '白糖', '冰糖', '红糖', '油', '食用油', '植物油', '菜籽油', '花生油', '香油', '麻油',
  '酱油', '生抽', '生抽酱油', '老抽', '老抽酱油', '蚝油', '料酒', '味精', '鸡精', '鸡粉', '鸡汁',
  '醋', '陈醋', '香醋', '米醋', '白醋',
  // 常备香料与淀粉
  '十三香', '五香粉', '胡椒粉', '黑胡椒', '白胡椒', '黑胡椒粉', '白胡椒粉', '花椒', '麻椒', '八角', '桂皮', '香叶',
  '淀粉', '水淀粉', '生粉', '玉米淀粉', '土豆淀粉'
];

export function isCommonIngredient(name: string): boolean {
  if (!name) return false;
  const clean = name
    .replace(/[\d\.\s\+\-\*\/]+/g, '')
    .replace(/(g|kg|ml|l|勺|个|块|片|根|克|千克|毫升|升|少许|适量|适度|大匙|小匙|包|头|粒|\(.*?\)|（.*?）)/gi, '')
    .trim()
    .toLowerCase();

  return COMMON_INGREDIENTS_WHITELIST.some(
    (w) => clean === w.toLowerCase() || clean.includes(w.toLowerCase()) || w.toLowerCase().includes(clean)
  );
}

/**
 * 寻味专属匹配算法 (彻底锁死边界条件防线)
 */
export function calculateInspirationMatch(
  rawIngredients: any,
  userIngredients: string[]
): MatchResult {
  const cleanUserSet = new Set(
    (userIngredients || []).map((u) => u.trim().toLowerCase()).filter(Boolean)
  );

  // 拦截 1：如果用户当前没有选中任何食材，绝对强制返回 score = 0，绝不上报 100%
  if (cleanUserSet.size === 0) {
    return {
      score: 0,
      level: 'lacking',
      levelLabel: '储备不足',
      matchedCount: 0,
      totalCount: 0,
      missingIngredients: [],
      matchedIngredients: [],
    };
  }

  const normalizedList = normalizeIngredients(rawIngredients);

  // 拦截 2：如果菜谱食材解析为空，绝对强制返回 score = 0
  if (!normalizedList || normalizedList.length === 0) {
    return {
      score: 0,
      level: 'lacking',
      levelLabel: '储备不足',
      matchedCount: 0,
      totalCount: 0,
      missingIngredients: [],
      matchedIngredients: [],
    };
  }

  // 过滤掉常备调味料白名单，提取核心主用食材
  const coreIngredients = normalizedList.filter((ing) => !isCommonIngredient(ing.name));

  // 若菜谱经过白名单过滤后没有核心食材，使用原始列表作为分母
  const targetList = coreIngredients.length > 0 ? coreIngredients : normalizedList;
  const totalCount = targetList.length;

  if (totalCount === 0) {
    return {
      score: 0,
      level: 'lacking',
      levelLabel: '储备不足',
      matchedCount: 0,
      totalCount: 0,
      missingIngredients: [],
      matchedIngredients: [],
    };
  }

  const matched: IngredientItem[] = [];
  const missing: IngredientItem[] = [];

  targetList.forEach((ing) => {
    const cleanName = ing.name
      .replace(/[\d\.\s\+\-\*\/]+/g, '')
      .replace(/(g|kg|ml|l|勺|个|块|片|根|克|千克|毫升|升|少许|适量|适度|大匙|小匙|包|头|粒|\(.*?\)|（.*?）)/gi, '')
      .trim()
      .toLowerCase();

    const isHit = Array.from(cleanUserSet).some(
      (userItem) =>
        (cleanName && (cleanName.includes(userItem) || userItem.includes(cleanName))) ||
        ing.name.toLowerCase().includes(userItem)
    );

    if (isHit) {
      matched.push(ing);
    } else {
      missing.push(ing);
    }
  });

  const matchedCount = matched.length;

  if (matchedCount === 0) {
    return {
      score: 0,
      level: 'lacking',
      levelLabel: '储备不足',
      matchedCount: 0,
      totalCount,
      missingIngredients: missing,
      matchedIngredients: [],
    };
  }

  const rawScore = (matchedCount / totalCount) * 100;
  const score = isNaN(rawScore) || !isFinite(rawScore) ? 0 : Math.round(rawScore);

  let level: 'exact' | 'easy' | 'lacking' = 'lacking';
  let levelLabel = '推荐采购';

  if (score === 100) {
    level = 'exact';
    levelLabel = '直接下锅';
  } else if (score >= 70) {
    level = 'easy';
    levelLabel = '轻松可做';
  } else {
    level = 'lacking';
    levelLabel = '储备不足';
  }

  return {
    score,
    level,
    levelLabel,
    matchedCount,
    totalCount,
    missingIngredients: missing,
    matchedIngredients: matched,
  };
}

// ==================== 卡路里交通灯标签 (后端 AI 直出 + 数据库直读) ====================

export interface CalorieBadgeInfo {
  label: string;
  shortLabel: string;
  badgeStyle: string;
}

/**
 * 直接读取数据库直读的 recipe.calorie_density 进行 4 档交通灯视觉渲染
 * 若无数值、为 0 或属于宝宝辅食 (target_user === 'baby')，直接返回 null 予以隐藏
 */
export function getCalorieBadge(calorieDensity?: number, targetUser?: string): CalorieBadgeInfo | null {
  if (!calorieDensity || calorieDensity <= 0 || targetUser === 'baby') {
    return null;
  }

  const val = Math.round(calorieDensity);

  if (val < 100) {
    return {
      label: `🟢 放心低卡 ${val}kcal`,
      shortLabel: `🟢 放心低卡 ${val}kcal`,
      badgeStyle: 'bg-emerald-50/90 text-emerald-700 font-extrabold border border-emerald-200/80 shadow-2xs',
    };
  } else if (val < 180) {
    return {
      label: `🟡 热量适中 ${val}kcal`,
      shortLabel: `🟡 热量适中 ${val}kcal`,
      badgeStyle: 'bg-amber-50/90 text-amber-800 font-extrabold border border-amber-200/80 shadow-2xs',
    };
  } else if (val < 250) {
    return {
      label: `🟠 有点放纵 ${val}kcal`,
      shortLabel: `🟠 有点放纵 ${val}kcal`,
      badgeStyle: 'bg-orange-50/90 text-orange-800 font-extrabold border border-orange-200/80 shadow-2xs',
    };
  } else {
    return {
      label: `🔴 放纵高卡 ${val}kcal`,
      shortLabel: `🔴 放纵高卡 ${val}kcal`,
      badgeStyle: 'bg-rose-50/90 text-rose-700 font-extrabold border border-rose-200/80 shadow-2xs',
    };
  }
}



