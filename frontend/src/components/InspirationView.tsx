import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, Plus, Check, Sparkles, X, ChevronRight } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { calculateInspirationMatch, getCalorieBadge } from '../utils/recipeHelper';
import { getRecipeThumbnailUrl } from '../utils/imageHelper';
import { pb } from '../lib/pocketbase';
import { MOCK_RECIPES } from '../mock/mockData';
import type { RecipeRecord } from '../types';

// 全量高频食材推荐与联想词库
const SUGGESTION_POOL = [
  '猪肉', '牛肉', '鸡蛋', '西红柿', '鸡肉', '土豆', '青椒', '虾',
  '山药', '豆腐', '木耳', '洋葱', '黄瓜', '茄子', '香菇', '西兰花',
  '白菜', '胡萝卜', '五花肉', '大葱', '蒜苔', '金针菇', '排骨', '蛤蜊'
];

export const InspirationView: React.FC = () => {
  const {
    isInspirationOpen,
    closeInspiration,
    addRecipeFromInspiration,
    removeFromPrep,
    isInPrep,
    setActiveTab,
    activeGroup,
    setActiveGroup,
    openRecipeDetail,
  } = useAppStore();

  const [inputQuery, setInputQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allRecipes, setAllRecipes] = useState<RecipeRecord[]>(MOCK_RECIPES);
  const [isLoading, setIsLoading] = useState(false);

  // Toast 轻提示 State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 加载全量菜谱数据
  useEffect(() => {
    if (!isInspirationOpen) return;

    let isMounted = true;
    const fetchAllRecipes = async () => {
      setIsLoading(true);
      try {
        const records = await pb.collection('recipes').getFullList<RecipeRecord>({
          sort: '-created',
        });
        if (isMounted && Array.isArray(records) && records.length > 0) {
          setAllRecipes(records);
        }
      } catch (err) {
        console.warn('PocketBase 获取全量菜谱失败，降级使用本地 Mock 菜谱:', err);
        if (isMounted) {
          setAllRecipes(MOCK_RECIPES);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchAllRecipes();
    return () => {
      isMounted = false;
    };
  }, [isInspirationOpen]);

  // 动态匹配与互斥转移列表
  const unselectedSuggestions = useMemo(() => {
    const trimmedInput = inputQuery.trim();
    if (trimmedInput) {
      // 输入模式: 实时联想过滤 (排除已选)
      return SUGGESTION_POOL.filter(
        (item) => item.includes(trimmedInput) && !selectedTags.includes(item)
      );
    } else {
      // 默认模式: 互斥转移 (排除已选)
      return SUGGESTION_POOL.filter((item) => !selectedTags.includes(item));
    }
  }, [inputQuery, selectedTags]);

  // 选中的参与匹配计算的食材列表
  const activeUserIngredients = useMemo(() => {
    const fromInput = inputQuery.trim();
    if (fromInput && !selectedTags.includes(fromInput)) {
      return [...selectedTags, fromInput];
    }
    return selectedTags;
  }, [inputQuery, selectedTags]);

  // 键盘 Enter 回车追加 Tag
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = inputQuery.trim();
      if (val) {
        if (!selectedTags.includes(val)) {
          setSelectedTags((prev) => [...prev, val]);
        }
        setInputQuery('');
      }
    }
  };

  // 点击下方待选胶囊转移至上方已选区
  const handleSelectSuggestion = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags((prev) => [...prev, tag]);
    }
    setInputQuery('');
  };

  // 从上方已选区移除 Tag (恢复至待选区)
  const removeTag = (tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  };

  // 触发“看菜下饭”匹配计算 (严格按当前 activeGroup 人群隔离)
  const matchedResults = useMemo(() => {
    if (activeUserIngredients.length === 0) {
      return [];
    }

    const targetRecipes = allRecipes.filter(
      (r) => (r.target_user || 'adult') === activeGroup
    );

    const calculated = targetRecipes.map((recipe) => {
      const match = calculateInspirationMatch(recipe.ingredients, activeUserIngredients);
      return { recipe, match };
    });

    // 筛选出有匹配度 (score > 0) 的菜谱，并按匹配度降序排列
    return calculated
      .filter((item) => item.match.score > 0)
      .sort((a, b) => b.match.score - a.match.score);
  }, [allRecipes, activeUserIngredients]);

  // 双向切换（Toggle）添加 / 移除菜谱到备菜清单
  const handleToggleRecipe = (recipe: RecipeRecord) => {
    if (isInPrep(recipe.id)) {
      // 已在清单中：执行移除 Action
      removeFromPrep(recipe.id);
    } else {
      // 未在清单中：执行添加 Action 并弹窗 Toast
      addRecipeFromInspiration(recipe, activeUserIngredients);
      setToastMessage(`已将【${recipe.name}】加入备菜清单，去查看 ➡️`);

      setTimeout(() => {
        setToastMessage(null);
      }, 4000);
    }
  };

  // 点击 Toast 直接跳转备菜页闭环
  const handleToastClick = () => {
    setToastMessage(null);
    closeInspiration();
    setActiveTab('prep');
  };

  if (!isInspirationOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-0 z-50 bg-[#F7F8FA] flex flex-col font-sans select-none overflow-hidden text-gray-800"
      >
        {/* Toast 跳转轻提示浮窗 (顶层浮动 + 点击直达备菜页) */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              onClick={handleToastClick}
              className="fixed top-16 left-1/2 -translate-x-1/2 z-60 bg-gray-900/95 text-white px-5 py-3 rounded-full shadow-2xl flex items-center space-x-2 border border-gray-700/80 cursor-pointer active:scale-95 transition-transform"
            >
              <Sparkles className="w-4 h-4 text-[#FFC300] shrink-0" />
              <span className="text-xs font-black tracking-wide">{toastMessage}</span>
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sticky 顶栏：返回按钮、页面标题与人群场景切换 */}
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-gray-200/80 px-4 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] pb-3 flex items-center justify-between shadow-2xs">
          <div className="flex items-center min-w-0">
            <button
              onClick={closeInspiration}
              className="w-9 h-9 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-full flex items-center justify-center transition-colors cursor-pointer mr-2.5 shrink-0"
              title="返回"
            >
              <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
            </button>
            <h1 className="text-base sm:text-lg font-black text-gray-900 truncate">🍳 看菜做饭</h1>
          </div>

          {/* 人群场景切换 (大人吃 vs 等等吃) */}
          <div className="flex bg-gray-100/90 p-0.5 rounded-xl border border-gray-200/60 shrink-0">
            <button
              onClick={() => setActiveGroup('adult')}
              className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                activeGroup === 'adult'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              👨‍👩‍👦 大人
            </button>
            <button
              onClick={() => setActiveGroup('baby')}
              className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                activeGroup === 'baby'
                  ? 'bg-white text-amber-900 shadow-2xs'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              👶 等等
            </button>
          </div>
        </div>

        {/* 可滚动页面内容主体 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
          {/* 1. 高聚焦输入区 (顶部卡片，Tag Input 极简多选与选区转移) */}
          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-2xs space-y-3">
            {/* 上方已选食材 Tag 气泡区 (带 × 按钮删除，删除后可退回下方待选区) */}
            <AnimatePresence>
              {selectedTags.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap gap-2 pb-2 border-b border-gray-100"
                >
                  {selectedTags.map((tag) => (
                    <motion.span
                      key={tag}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-black bg-amber-400 text-gray-900 shadow-xs border border-amber-500/30 select-none"
                    >
                      <span>{tag}</span>
                      <button
                        onClick={() => removeTag(tag)}
                        className="w-4 h-4 rounded-full bg-amber-500/40 hover:bg-amber-600/60 text-gray-900 flex items-center justify-center cursor-pointer transition-colors"
                        title="删除食材"
                      >
                        <X className="w-3 h-3 stroke-[3]" />
                      </button>
                    </motion.span>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入食材搜索联想或按回车添加..."
                className="w-full bg-gray-50 rounded-xl pl-9 pr-9 py-2.5 text-xs font-bold text-gray-800 outline-none border border-gray-200/70 focus:bg-white focus:ring-2 focus:ring-[#FFC300]/50 transition-all"
              />
              {inputQuery && (
                <button
                  onClick={() => setInputQuery('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* 下方待选胶囊 (实时输入联想 / 互斥选区转移) */}
            <div>
              <div className="text-[11px] font-bold text-gray-400 mb-2 flex justify-between items-center">
                <span>{inputQuery.trim() ? '🔍 匹配联想候选 (点击直接添加)：' : '快捷推荐食材 (选后自动移至上方)：'}</span>
                {(selectedTags.length > 0 || inputQuery.trim() !== '') && (
                  <div className="flex items-center space-x-1.5">
                    <span className="text-amber-700 font-extrabold">已选 {activeUserIngredients.length} 种</span>
                    <span className="text-gray-300 font-normal">|</span>
                    <button
                      onClick={() => {
                        setInputQuery('');
                        setSelectedTags([]);
                      }}
                      className="text-gray-400 hover:text-gray-700 font-extrabold transition-colors cursor-pointer"
                    >
                      清空
                    </button>
                  </div>
                )}
              </div>

              {unselectedSuggestions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {unselectedSuggestions.slice(0, 12).map((tag) => (
                    <motion.button
                      key={tag}
                      whileTap={{ scale: 0.93 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      onClick={() => handleSelectSuggestion(tag)}
                      className="px-3 py-1.5 rounded-full text-xs font-extrabold transition-all duration-150 cursor-pointer select-none bg-gray-50 text-gray-700 border border-gray-200/80 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-900"
                    >
                      + {tag}
                    </motion.button>
                  ))}
                </div>
              ) : (
                inputQuery.trim() !== '' && (
                  <div className="text-xs text-gray-400 py-1 font-bold">
                    未在快捷推荐中找到“{inputQuery.trim()}”，按 <kbd className="bg-gray-100 px-1.5 py-0.5 rounded border border-gray-300 text-gray-600 font-mono text-[10px]">Enter</kbd> 直接追加
                  </div>
                )
              )}
            </div>
          </div>

          {/* 3. 结果展示区与自然流式排版 */}
          {activeUserIngredients.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-black text-gray-700">
                  根据已有食材匹配到的菜谱 ({matchedResults.length})
                </span>
                <span className="text-[10px] font-bold text-gray-400">已忽略常备调料</span>
              </div>

              {isLoading ? (
                <div className="bg-white rounded-2xl p-6 text-center text-xs font-bold text-gray-400 animate-pulse border border-gray-100">
                  🔍 正在计算最佳看菜做饭组合...
                </div>
              ) : matchedResults.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 text-center text-gray-400 flex flex-col items-center justify-center border border-gray-100">
                  <span className="text-3xl mb-2">🍽️</span>
                  <span className="text-sm font-bold text-gray-700 mb-1">未匹配到合适菜谱</span>
                  <span className="text-xs text-gray-400">尝试勾选或输入其他食材试试吧~</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {matchedResults.map(({ recipe, match }) => {
                    const added = isInPrep(recipe.id);
                    const thumbInfo = getRecipeThumbnailUrl(recipe);

                    let cardStyle = 'bg-white border border-gray-100 shadow-2xs';
                    if (match.score === 100) {
                      cardStyle = 'bg-gradient-to-r from-emerald-50/95 via-white to-emerald-50/30 border-2 border-emerald-400 shadow-md';
                    } else if (match.score >= 80) {
                      cardStyle = 'bg-gradient-to-r from-amber-50/40 via-white to-white border border-amber-200/60 shadow-2xs';
                    } else if (match.score >= 50) {
                      cardStyle = 'bg-gradient-to-r from-orange-50/30 via-white to-white border border-orange-100 shadow-2xs';
                    } else if (match.score >= 20) {
                      cardStyle = 'bg-gradient-to-r from-sky-50/30 via-white to-white border border-sky-100/70 shadow-2xs';
                    } else if (match.score > 0) {
                      cardStyle = 'bg-white border border-gray-100 shadow-2xs';
                    }

                    return (
                      <motion.div
                        key={recipe.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.01 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                        onClick={() => openRecipeDetail(recipe)}
                        className={`p-4 rounded-2xl transition-all relative cursor-pointer select-none ${cardStyle}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3 min-w-0 flex-1 pr-2">
                            <div className="w-13 h-13 bg-amber-50 rounded-2xl flex items-center justify-center text-2xl border border-amber-100/60 shadow-inner shrink-0 overflow-hidden">
                              {thumbInfo.isImage ? (
                                <img src={thumbInfo.value} alt={recipe.name} className="w-full h-full object-cover" />
                              ) : (
                                <span>{thumbInfo.value}</span>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="text-base font-black text-gray-900 truncate">
                                {recipe.name}
                              </div>
                              {(() => {
                                const calBadge = getCalorieBadge(recipe.calorie_density, recipe.target_user);
                                
                                let matchBadgeNode = null;
                                if (match.score === 100) {
                                  matchBadgeNode = (
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-emerald-500 text-white shadow-2xs shrink-0 border border-emerald-400">
                                      🔥 直接下锅 100%
                                    </span>
                                  );
                                } else if (match.score >= 80) {
                                  matchBadgeNode = (
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-amber-100 text-amber-900 shrink-0 border border-amber-200/80">
                                      ✨ 临门一脚 {match.score}%
                                    </span>
                                  );
                                } else if (match.score >= 50) {
                                  matchBadgeNode = (
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-orange-100 text-orange-900 shrink-0 border border-orange-200/80">
                                      🥘 主料到位 {match.score}%
                                    </span>
                                  );
                                } else if (match.score >= 20) {
                                  matchBadgeNode = (
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-sky-100 text-sky-900 shrink-0 border border-sky-200/80">
                                      🌱 凑个热闹 {match.score}%
                                    </span>
                                  );
                                } else if (match.score > 0) {
                                  matchBadgeNode = (
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-gray-100 text-gray-700 shrink-0 border border-gray-200/80">
                                      💡 灵感碰撞 {match.score}%
                                    </span>
                                  );
                                }

                                return (
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1 max-w-full overflow-hidden shrink min-w-0">
                                    {matchBadgeNode}

                                    <span className="text-[10px] text-gray-600 font-bold px-2 py-0.5 bg-gray-100 rounded-md shrink-0">
                                      {recipe.category || '菜品'}
                                    </span>

                                    {calBadge && (
                                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] truncate max-w-[120px] ${calBadge.badgeStyle}`}>
                                        {calBadge.shortLabel}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* 按钮微交互与双向切换：添加 / [✅ 已加] 移除 (阻止冒泡防止触发弹窗) */}
                          <motion.button
                            whileTap={{ scale: 0.92 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleRecipe(recipe);
                            }}
                            title={added ? '点击移出备菜清单' : '加入备菜清单'}
                            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shrink-0 flex items-center space-x-1 ${
                              added
                                ? 'bg-gray-100 hover:bg-gray-200/80 text-gray-500 border border-gray-200/80 shadow-none'
                                : 'bg-[#FFC300] hover:bg-amber-400 text-gray-900 shadow-2xs'
                            }`}
                          >
                            {added ? (
                              <>
                                <Check className="w-3.5 h-3.5 stroke-[3]" />
                                <span>已加</span>
                              </>
                            ) : (
                              <>
                                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                <span>添加</span>
                              </>
                            )}
                          </motion.button>
                        </div>

                        {/* 解决信息密度低问题：高亮显示核心缺失食材 */}
                        {match.missingIngredients.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-gray-100 flex items-center space-x-1.5 text-xs font-bold text-gray-500 truncate">
                            <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded shrink-0 text-[10px] font-extrabold">
                              还需准备:
                            </span>
                            <span className="truncate text-gray-700 font-semibold">
                              {match.missingIngredients.map((ing) => ing.name).join('、')}
                            </span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default InspirationView;
