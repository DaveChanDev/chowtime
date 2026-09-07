import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Calendar, Search, Check, Utensils } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { pb } from '../lib/pocketbase';
import type { RecipeRecord, TargetUser } from '../types';

interface RetroactiveLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (retroDate: string) => void;
}

function getYesterdayString(): string {
  const yesterday = new Date(Date.now() - 86400000);
  const y = yesterday.getFullYear();
  const m = String(yesterday.getMonth() + 1).padStart(2, '0');
  const d = String(yesterday.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 全局内存级轻量菜谱列表缓存 (0毫秒瞬间呈现)
let globalLightRecipesCache: RecipeRecord[] | null = null;

export const RetroactiveLogModal: React.FC<RetroactiveLogModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { addCookingRecord } = useAppStore();

  const [dateStr, setDateStr] = useState<string>(getYesterdayString());
  const [allRecipes, setAllRecipes] = useState<RecipeRecord[]>(globalLightRecipesCache || []);
  const [isLoadingRecipes, setIsLoadingRecipes] = useState<boolean>(!globalLightRecipesCache);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([]);
  
  // 人群过滤：全部 | 大人吃 | 等等吃
  const [targetGroupFilter, setTargetGroupFilter] = useState<'all' | TargetUser>('all');
  
  const [rating, setRating] = useState<number>(5);
  const [note, setNote] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 打开弹窗时重置表单状态，并使用精简字段极速拉取/静默更新
  useEffect(() => {
    if (isOpen) {
      setDateStr(getYesterdayString());
      setSelectedRecipeIds([]);
      setTargetGroupFilter('all');
      setRating(5);
      setNote('');
      setSearchQuery('');
      setErrorMsg(null);
      setIsSubmitting(false);

      if (globalLightRecipesCache && globalLightRecipesCache.length > 0) {
        setAllRecipes(globalLightRecipesCache);
        setIsLoadingRecipes(false);
      } else {
        setIsLoadingRecipes(true);
      }

      // 精准指定 fields 限制返回体积极致瘦身，只加载名字、分类、人群与缩略图，摒弃庞大步骤文本
      pb.collection('recipes')
        .getFullList<RecipeRecord>({
          sort: '-created',
          fields: 'id,name,category,target_user,thumbnail',
        })
        .then((res) => {
          const list = res || [];
          globalLightRecipesCache = list;
          setAllRecipes(list);
        })
        .catch((err) => {
          console.warn('精简极速拉取菜谱数据警告:', err);
        })
        .finally(() => {
          setIsLoadingRecipes(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleSelectRecipe = (id: string) => {
    setErrorMsg(null);
    setSelectedRecipeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const filteredRecipes = allRecipes.filter((r) => {
    if (targetGroupFilter !== 'all' && r.target_user !== targetGroupFilter) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = r.name?.toLowerCase().includes(q);
    const catMatch = r.category?.toLowerCase().includes(q);
    return nameMatch || catMatch;
  });

  const handleSubmit = async () => {
    if (!dateStr) {
      setErrorMsg('请选择历史补录日期！');
      return;
    }

    if (selectedRecipeIds.length === 0) {
      setErrorMsg('请至少勾选一道补录的菜品！');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const selectedDishes = allRecipes
        .filter((r) => selectedRecipeIds.includes(r.id))
        .map((r) => ({
          id: r.id,
          name: r.name || '美味菜品',
          thumbnail: r.thumbnail || (r.target_user === 'baby' ? '🥣' : '🍳'),
          target_user: r.target_user || 'adult',
        }));

      const now = new Date();
      const newRecord = {
        id: `rec_${Date.now()}`,
        date: dateStr, // 用户选定的历史业务日期穿透写入
        dishes: selectedDishes,
        rating: rating,
        note: note.trim() || undefined,
        created: now.toISOString(),
      };

      await addCookingRecord(newRecord);

      if (onSuccess) {
        onSuccess(dateStr);
      }
      onClose();
    } catch (err: any) {
      console.error('补录打卡失败:', err);
      setErrorMsg('保存失败，请重试或检查网络状态');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-gray-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="bg-white rounded-3xl p-5 w-full max-w-sm shadow-2xl border border-gray-100 flex flex-col max-h-[85vh] overflow-hidden relative text-left"
        >
          {/* 顶栏标题 */}
          <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 bg-amber-100 text-gray-900 rounded-full flex items-center justify-center font-black text-lg">
                📝
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900">补录做菜打卡</h3>
                <p className="text-[11px] text-gray-400 font-bold">事后补记做菜成果，让打卡不遗漏</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full flex items-center justify-center cursor-pointer transition-colors"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* 表单滚动区域 */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar text-left">
            {/* 1. 日期选择器 (Date Picker) */}
            <div>
              <label className="block text-xs font-black text-gray-700 mb-1.5 flex items-center">
                <Calendar className="w-3.5 h-3.5 mr-1 text-[#FFC300]" />
                <span>补录日期</span>
                <span className="ml-auto text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/50">
                  默认选中昨天
                </span>
              </label>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-gray-800 outline-none focus:border-[#FFC300] focus:ring-2 focus:ring-[#FFC300]/30 transition-all cursor-pointer"
              />
            </div>

            {/* 2. 菜品选择列表 (含人群快捷筛选) */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-black text-gray-700 flex items-center">
                  <Utensils className="w-3.5 h-3.5 mr-1 text-[#FFC300]" />
                  <span>选择菜品</span>
                  {selectedRecipeIds.length > 0 && (
                    <span className="ml-1.5 text-[11px] text-[#FFC300] bg-gray-900 px-2 py-0.5 rounded-full font-black">
                      已选 {selectedRecipeIds.length} 道
                    </span>
                  )}
                </label>

                {/* 人群快捷 Filter Pill Buttons: [全部] [👨‍👩‍👦 大人] [👶 等等] */}
                <div className="flex bg-gray-100 p-0.5 rounded-lg text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setTargetGroupFilter('all')}
                    className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      targetGroupFilter === 'all'
                        ? 'bg-white text-gray-900 shadow-2xs font-extrabold'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    全部
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetGroupFilter('adult')}
                    className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      targetGroupFilter === 'adult'
                        ? 'bg-[#FFC300] text-gray-900 shadow-2xs font-extrabold'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    👨‍👩‍👦 大人
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetGroupFilter('baby')}
                    className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                      targetGroupFilter === 'baby'
                        ? 'bg-[#FFC300] text-gray-900 shadow-2xs font-extrabold'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    👶 等等
                  </button>
                </div>
              </div>

              {/* 菜品搜索 */}
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索菜名或分类..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-[11px] font-bold text-gray-800 outline-none focus:border-[#FFC300]"
                />
              </div>

              {/* 菜品多选框 */}
              <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-2 max-h-40 overflow-y-auto space-y-1.5 no-scrollbar">
                {isLoadingRecipes ? (
                  <div className="text-xs text-gray-400 py-6 text-center font-bold">
                    ⚡ 正在极速载入菜单...
                  </div>
                ) : filteredRecipes.length === 0 ? (
                  <div className="text-xs text-gray-400 py-6 text-center font-bold">
                    没有找到符合条件的菜谱
                  </div>
                ) : (
                  filteredRecipes.map((recipe) => {
                    const isSelected = selectedRecipeIds.includes(recipe.id);
                    return (
                      <div
                        key={recipe.id}
                        onClick={() => toggleSelectRecipe(recipe.id)}
                        className={`flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-amber-100/70 border-[#FFC300] text-gray-900 shadow-2xs font-extrabold'
                            : 'bg-white border-gray-100 hover:bg-gray-100/60 text-gray-700 font-bold'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <span className="text-base shrink-0">
                            {recipe.thumbnail || (recipe.target_user === 'baby' ? '🥣' : '🍳')}
                          </span>
                          <span className="text-xs truncate">{recipe.name}</span>
                          {recipe.target_user === 'baby' && (
                            <span className="text-[10px] bg-amber-200 text-amber-900 font-black px-1.5 py-0.2 rounded-md shrink-0">
                              宝宝
                            </span>
                          )}
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors shrink-0 ${
                            isSelected
                              ? 'bg-[#FFC300] text-gray-900'
                              : 'border border-gray-300 text-transparent'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 3. 5星评分 */}
            <div>
              <label className="block text-xs font-black text-gray-700 mb-1.5">
                评分反馈
              </label>
              <div className="flex space-x-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    className="cursor-pointer focus:outline-none transition-transform active:scale-125"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= rating
                          ? 'text-[#FFC300] fill-[#FFC300]'
                          : 'text-gray-200 fill-gray-100'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* 4. 心得/总结输入 */}
            <div>
              <label className="block text-xs font-black text-gray-700 mb-1.5">
                总结心得 <span className="text-gray-400 font-normal">(选填)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="记录当时做这顿饭的感受或味道..."
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs font-bold text-gray-800 outline-none focus:border-[#FFC300] h-16 resize-none"
              />
            </div>

            {/* 报错提示区 */}
            {errorMsg && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-bold text-center">
                ⚠️ {errorMsg}
              </div>
            )}
          </div>

          {/* 5. 提交按钮区 */}
          <div className="pt-3 mt-2 border-t border-gray-100 shrink-0">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full py-3 bg-[#FFC300] hover:bg-amber-400 text-gray-900 font-black text-sm rounded-full shadow-md active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>提交补录中...</span>
              ) : (
                <span>✅ 确认补录</span>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
