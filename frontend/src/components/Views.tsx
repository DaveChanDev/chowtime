import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, X, UtensilsCrossed, Sparkles, ShoppingBag, Heart, Star, Search, Edit3 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useRecipesQuery } from '../hooks/useRecipes';
import { getRecipeThumbnailUrl } from '../utils/imageHelper';
import { calculateRecipeMatch, aggregateShoppingList, getCalorieBadge } from '../utils/recipeHelper';
import { RecipeCardSkeleton } from './RecipeCardSkeleton';
import { RetroactiveLogModal } from './RetroactiveLogModal';
import { EditCookingRecordModal } from './EditCookingRecordModal';
import type { CookingRecord } from '../types';

// ==================== TAB 1: 菜谱主页 ====================
export const RecipeView: React.FC = () => {
  const {
    activeGroup,
    activeCategory,
    setActiveGroup,
    setActiveCategory,
    addToPrep,
    removeFromPrep,
    isInPrep,
    openAddModal,
    openRecipeDetail,
    pantryList,
  } = useAppStore();

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useRecipesQuery(activeGroup, activeCategory);

  const recipes = data?.pages.flatMap((page) => page.items) || [];
  const [searchQuery, setSearchQuery] = useState('');
  const observerTargetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const target = observerTargetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const adultCats = ['全部', '荤菜', '素菜', '凉菜', '汤羹', '主食'];
  const babyCats = ['全部', '饭面主食', '营养汤粥', '宝宝小菜', '饼类面点'];
  const categories = activeGroup === 'adult' ? adultCats : babyCats;

  const filteredRecipes = recipes.filter((r) => {
    if (!r) return false;
    if (r.target_user !== activeGroup) return false;
    if (activeCategory !== '全部' && r.category !== activeCategory) return false;

    if (searchQuery.trim() !== '') {
      try {
        const q = searchQuery.toLowerCase().trim();
        
        // 1. 安全匹配菜名
        if (typeof r.name === 'string' && r.name.toLowerCase().includes(q)) {
          return true;
        }

        // 2. 安全匹配分类与标签
        if (typeof r.category === 'string' && r.category.toLowerCase().includes(q)) {
          return true;
        }
        if (typeof r.tag === 'string' && r.tag.toLowerCase().includes(q)) {
          return true;
        }

        // 3. 安全匹配食材 (兼容对象数组、字符串数组、纯文本字符串等各种数据形态，防 TypeError)
        const ingData: any = r.ingredients;
        if (Array.isArray(ingData)) {
          const matchIng = ingData.some((item: any) => {
            if (!item) return false;
            if (typeof item === 'string') return item.toLowerCase().includes(q);
            if (typeof item === 'object' && typeof item.name === 'string') {
              return item.name.toLowerCase().includes(q);
            }
            return false;
          });
          if (matchIng) return true;
        } else if (typeof ingData === 'string') {
          if ((ingData as string).toLowerCase().includes(q)) return true;
        }

        return false;
      } catch (err) {
        console.error('搜索过滤防护拦截异常:', err);
        return false;
      }
    }

    return true;
  });

  const sortedFilteredRecipes = [...filteredRecipes].sort((a, b) => {
    const aPrep = isInPrep(a.id);
    const bPrep = isInPrep(b.id);
    if (aPrep && !bPrep) return -1;
    if (!aPrep && bPrep) return 1;
    return 0;
  });

  return (
    <div className="flex-1 flex flex-col pb-[calc(12rem+env(safe-area-inset-bottom,0px))] select-none">
      {/* 顶部 Sticky Header (向下增加顶边距防贴头遮挡 + 手势隔离防滚动透传) */}
      <div
        onTouchMove={(e) => e.stopPropagation()}
        className="pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] pb-3 px-4 bg-white sticky top-0 z-10 rounded-b-2xl shadow-sm border-b border-gray-100/60 touch-none"
      >
        <div className="flex justify-between items-center mb-2">
          <div className="flex bg-gray-100/90 p-1 rounded-full text-base font-bold relative">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveGroup('adult')}
              className={`px-4 py-2 rounded-full transition-all duration-200 z-10 cursor-pointer ${
                activeGroup === 'adult'
                  ? 'bg-[#FFC300] text-gray-900 shadow-2xs font-extrabold'
                  : 'text-gray-500 hover:text-gray-800 font-medium'
              }`}
            >
              👨‍👩‍👦 大人吃
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveGroup('baby')}
              className={`px-4 py-2 rounded-full transition-all duration-200 z-10 cursor-pointer ${
                activeGroup === 'baby'
                  ? 'bg-[#FFC300] text-gray-900 shadow-2xs font-extrabold'
                  : 'text-gray-500 hover:text-gray-800 font-medium'
              }`}
            >
              👶 等等吃
            </motion.button>
          </div>

          <motion.button
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            onClick={openAddModal}
            title="添加新菜"
            className="px-4 py-2 bg-[#FFC300] text-gray-900 hover:brightness-105 rounded-full font-black text-sm flex items-center space-x-1.5 shadow-2xs cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>新建</span>
          </motion.button>
        </div>

        {/* 首页实时搜索框 */}
        <div className="relative mb-2">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索菜名或食材（如：番茄 / 鸡翅）..."
            className="w-full bg-gray-100/90 rounded-full pl-9 pr-8 py-2 text-xs font-bold text-gray-800 outline-none placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-[#FFC300]/50 transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 动态分类 Filter (仅允许横向滑动，隔离纵向滚动) */}
        <div
          onTouchMove={(e) => e.stopPropagation()}
          className="flex space-x-1.5 overflow-x-auto text-xs whitespace-nowrap px-0.5 py-0.5 no-scrollbar touch-pan-x"
        >
          {categories.map((cat, idx) => (
            <motion.button
              key={cat || `cat_${idx}`}
              whileTap={{ scale: 0.92 }}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full font-bold transition-all duration-200 cursor-pointer ${
                activeCategory === cat
                  ? 'bg-[#FFC300] text-gray-900 font-extrabold shadow-2xs'
                  : 'bg-white text-gray-600 border border-gray-200/80 shadow-2xs hover:bg-gray-50'
              }`}
            >
              {cat}
            </motion.button>
          ))}
        </div>
      </div>

      {/* 菜品单列卡片、骨架屏或优雅空状态 */}
      <div className="px-3.5 py-2.5 space-y-2">
        {isLoading ? (
          <div key="loading_skeletons" className="space-y-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <RecipeCardSkeleton key={`skeleton_${idx}`} />
            ))}
          </div>
        ) : sortedFilteredRecipes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 px-4 flex flex-col items-center justify-center text-gray-400"
          >
            <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center text-3xl mb-3 shadow-inner border border-amber-100">
              🍽️
            </div>
            <div className="text-base font-black text-gray-800">暂无菜谱</div>
            <div className="text-xs text-gray-400 mt-1 mb-5">
              快点击右上角 ➕ 新建 按钮添加第一道美味菜谱吧！
            </div>
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={openAddModal}
              className="px-5 py-2.5 bg-[#FFC300] hover:bg-amber-400 text-gray-900 font-extrabold text-xs rounded-full shadow-xs transition-all cursor-pointer"
            >
              ➕ 新建菜谱
            </motion.button>
          </motion.div>
        ) : (
          <>
            <AnimatePresence mode="sync">
              {sortedFilteredRecipes.map((recipe, idx) => {
                const added = isInPrep(recipe.id);
                const isFav = recipe.is_favorite || (recipe.tag && recipe.tag.includes('爱吃'));
                const match = calculateRecipeMatch(recipe.ingredients, pantryList.map((p) => p.name));

                const handleToggle = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  if (added) {
                    removeFromPrep(recipe.id);
                  } else {
                    addToPrep(recipe);
                  }
                };

                const thumbInfo = getRecipeThumbnailUrl(recipe);

                // 卡片根据匹配度呈现差异化视觉层级
                let cardStyle = "bg-white border border-gray-100 shadow-2xs";
                let badgeStyle = "bg-gray-100 text-gray-600";

                if (match.level === 'exact') {
                  cardStyle = "bg-gradient-to-r from-emerald-50/80 via-white to-amber-50/40 border-2 border-emerald-400 shadow-xs scale-[1.01]";
                  badgeStyle = "bg-emerald-500 text-white font-black shadow-2xs";
                } else if (match.level === 'easy') {
                  cardStyle = "bg-white border border-amber-300 shadow-2xs";
                  badgeStyle = "bg-amber-500 text-white font-extrabold";
                } else {
                  cardStyle = "bg-white border border-gray-200/80 shadow-2xs opacity-95";
                  badgeStyle = "bg-gray-100 text-gray-500 font-bold";
                }

                return (
                  <div
                    key={recipe.id || `recipe_${idx}`}
                    onClick={() => openRecipeDetail(recipe)}
                    className={`flex flex-col p-3 rounded-xl transition-all duration-150 relative cursor-pointer group ${cardStyle}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3 min-w-0 pr-2 flex-1">
                        {/* 图片与 Emoji */}
                        <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-2xl border border-amber-100/60 shadow-inner shrink-0 relative overflow-hidden">
                          {thumbInfo.isImage ? (
                            <img src={thumbInfo.value} alt={recipe.name} loading="lazy" className="w-full h-full object-cover" />
                          ) : (
                            <span>{thumbInfo.value}</span>
                          )}
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <div className="text-base font-black text-gray-900 tracking-wide truncate flex items-center">
                            <span>{recipe.name || '美味菜品'}</span>
                            {isFav && (
                              <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500 ml-1.5 shrink-0" />
                            )}
                          </div>
                          
                          {(() => {
                            const calBadge = getCalorieBadge(recipe.calorie_density, recipe.target_user);
                            return (
                              <div className="flex flex-wrap items-center gap-1 mt-1 max-w-full overflow-hidden shrink min-w-0">
                                {added && (
                                  <span className="text-[10px] bg-emerald-500 text-white font-black px-1.5 py-0.5 rounded-md flex items-center space-x-0.5 shrink shadow-2xs">
                                    <span>📌 已选置顶</span>
                                  </span>
                                )}

                                {/* 极简卡路里交通灯标签 (数据库直读) */}
                                {calBadge && (
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md truncate max-w-[130px] shrink ${calBadge.badgeStyle}`} title={calBadge.label}>
                                    {calBadge.label}
                                  </span>
                                )}

                                {recipe.tag && recipe.tag.trim() !== '' && (
                                  recipe.tag.split(/[,，]+/).filter(Boolean).map((t, tIdx) => (
                                    <span key={tIdx} className="text-[10px] text-gray-500 font-bold px-1.5 py-0.5 bg-gray-100/80 rounded-md truncate max-w-[120px]">
                                      {t.trim()}
                                    </span>
                                  ))
                                )}
                                
                                {match.score > 0 && match.level !== 'lacking' && (
                                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] truncate ${badgeStyle}`}>
                                    {match.level === 'exact' ? '🍳 直接下锅 100%' : `${match.levelLabel} ${match.score}%`}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* 卡片右侧备菜操作按钮 */}
                      <motion.button
                        whileTap={{ scale: 0.92 }}
                        transition={{ duration: 0.1 }}
                        onClick={handleToggle}
                        title={added ? '已在备菜清单 (点击移除)' : '加入备菜清单'}
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold transition-all shrink-0 cursor-pointer ${
                          added
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-2xs'
                            : 'bg-[#FFC300] text-gray-900 hover:brightness-105 shadow-sm'
                        }`}
                      >
                        {added ? (
                          <Check className="w-5 h-5 stroke-[3]" />
                        ) : (
                          <Plus className="w-5 h-5 stroke-[3]" />
                        )}
                      </motion.button>
                    </div>
                  </div>
                );
              })}
            </AnimatePresence>
          </>
        )}

        {/* 适老化无限滚动触底指示器与探针元素 */}
        <div className="pt-3 pb-6 flex flex-col items-center justify-center">
          {isFetchingNextPage && (
            <div className="flex items-center space-x-2 py-3 text-amber-700 font-extrabold text-base animate-pulse bg-amber-50 px-6 py-2.5 rounded-full border border-amber-200/60 shadow-xs">
              <Sparkles className="w-5 h-5 animate-spin text-[#FFC300]" />
              <span>正在加载更多美味...</span>
            </div>
          )}
          {!hasNextPage && (
            <div className="text-sm font-bold text-gray-400 py-3 tracking-wide">
              ✨ 已经到底啦，已加载全部菜谱 ✨
            </div>
          )}
          <div ref={observerTargetRef} className="h-4 w-full" />
        </div>
        {/* 底部 TabBar 防遮挡充裕垫片 */}
        <div className="h-16 w-full shrink-0 pointer-events-none" />
      </div>
    </div>
  );
};

// ==================== TAB 2: 备菜页 (菜市场采购与摊位归类) ====================
export const PrepView: React.FC = () => {
  const { prepList, checkedIngredients, toggleIngredientCheck, removeFromPrep, openCooking, pantryList, openRecipeDetail } = useAppStore();

  const stallGroups = aggregateShoppingList(prepList, pantryList.map((p) => p.name));
  const [collapsedStalls, setCollapsedStalls] = useState<Record<string, boolean>>({
    '🧂 调料副食摊': true, // 调料等辅助摊位默认收起
  });

  const toggleStallCollapse = (cat: string) => {
    setCollapsedStalls((prev) => ({
      ...prev,
      [cat]: !prev[cat],
    }));
  };

  const handleStartCooking = () => {
    if (prepList.length === 0) {
      alert('备菜车还是空的，请先在菜谱页添加想做的菜吧！');
      return;
    }
    openCooking();
  };

  return (
    <div className="flex-1 flex flex-col pb-[calc(16rem+env(safe-area-inset-bottom,0px))] pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] px-4 select-none relative min-h-full">
      <h2 className="text-2xl font-black text-gray-900 mb-4 flex items-center">
        <span className="bg-[#FFC300] text-lg p-2 rounded-2xl mr-3 shadow-sm">🛒</span> 采购与备菜
      </h2>

      {/* 已选菜品卡片组 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
        <div className="text-sm font-bold text-gray-400 mb-3 flex justify-between items-center">
          <span>已选菜品 ({prepList.length})</span>
        </div>

        {prepList.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-8 flex flex-col items-center justify-center text-gray-400"
          >
            <ShoppingBag className="w-10 h-10 text-gray-300 mb-2 stroke-[1.5]" />
            <span className="text-sm font-bold">备菜车还是空的哦</span>
            <span className="text-sm text-gray-400 mt-1">去菜谱页挑选心仪菜品吧</span>
          </motion.div>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence>
              {prepList.map((item) => {
                const itemThumb = getRecipeThumbnailUrl(item);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    onClick={() => openRecipeDetail(item)}
                    className="flex justify-between items-center bg-gray-50 hover:bg-amber-50/80 p-3 rounded-xl border border-gray-100 hover:border-amber-200/80 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-xl border border-amber-100/60 shadow-2xs overflow-hidden shrink-0">
                        {itemThumb.isImage ? (
                          <img src={itemThumb.value} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <span>{itemThumb.value}</span>
                        )}
                      </div>
                      <span className="text-base font-bold text-gray-900 group-hover:text-amber-900 transition-colors">{item.name}</span>
                      {item.target_user === 'baby' && (
                        <span className="text-xs bg-[#FFC300] text-gray-900 font-extrabold px-2 py-0.5 rounded-full">
                          等等
                        </span>
                      )}
                    </div>
                  
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      transition={{ duration: 0.1 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromPrep(item.id);
                      }}
                      className="w-8 h-8 bg-white hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-full flex items-center justify-center shadow-2xs border border-gray-200 transition-colors cursor-pointer shrink-0"
                      title="移出待做清单"
                    >
                      <X className="w-4 h-4 stroke-[2.5]" />
                    </motion.button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* 菜市场摊位归类采购清单 (仅在有备菜菜品时计算并渲染) */}
      {prepList.length > 0 && (
        <div className="space-y-3 mb-6">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-lg font-black text-gray-900 flex items-center">
              <span className="bg-amber-100 text-amber-800 text-xs p-1.5 rounded-lg mr-2">📋</span> 菜市场采购清单
            </h3>
            {pantryList.length > 0 && (
              <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                已自动扣除冰箱余粮
              </span>
            )}
          </div>

          {stallGroups.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center text-sm text-gray-400 font-bold border border-gray-100 shadow-2xs">
              🎉 所选菜品无需额外采购！
            </div>
          ) : (
            stallGroups.map((group) => {
              const isCollapsed = !!collapsedStalls[group.category];
              return (
                <div key={group.category} className="bg-white rounded-2xl shadow-xs border border-gray-100/90 overflow-hidden">
                  {/* 摊位 Header */}
                  <button
                    onClick={() => toggleStallCollapse(group.category)}
                    className="w-full px-4 py-3 bg-gray-50/80 hover:bg-gray-100/60 flex justify-between items-center cursor-pointer select-none transition-colors border-b border-gray-100"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-black text-gray-900">{group.category}</span>
                      <span className="text-xs font-bold text-gray-400 bg-gray-200/60 px-2 py-0.5 rounded-full">
                        {group.items.length} 种
                      </span>
                    </div>
                    <span className="text-xs text-gray-400 font-bold">
                      {isCollapsed ? '展开 ▼' : '收起 ▲'}
                    </span>
                  </button>

                  {/* 摊位食材清单 */}
                  {!isCollapsed && (
                    <div className="p-3 space-y-1.5">
                      {group.items.map((ing) => {
                        const key = ing.name;
                        const isChecked = !!checkedIngredients[key];
                        return (
                          <label
                            key={ing.id || key}
                            className="flex items-center justify-between py-2 px-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer select-none border border-transparent hover:border-gray-100"
                          >
                            <div className="flex items-center space-x-3 min-w-0 flex-1">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleIngredientCheck(key)}
                                className="w-4 h-4 shrink-0 accent-[#FFC300] rounded cursor-pointer"
                              />
                              <span
                                className={`text-base font-extrabold truncate transition-all ${
                                  isChecked ? 'line-through text-gray-400 opacity-60' : 'text-gray-900'
                                }`}
                              >
                                {ing.name}
                              </span>
                            </div>

                            {ing.amount && (
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded-md ml-2 shrink-0 ${
                                  isChecked
                                    ? 'bg-gray-100 text-gray-400'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200/60'
                                }`}
                              >
                                {ing.amount}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

        {/* 大面积安全底部防遮挡垫片 */}
        <div className="h-44 w-full shrink-0 pointer-events-none" />

        {/* 右下角美团黄亲和力 FAB 开始做饭按钮 (去冗余播放图标，仅保留刀叉与文字) */}
        {prepList.length > 0 && (
          <div className="fixed bottom-32 right-6 z-40">
            <motion.button
              whileTap={{ scale: 0.92 }}
              whileHover={{ scale: 1.05 }}
              onClick={handleStartCooking}
              className="bg-[#FFC300] hover:bg-amber-400 text-gray-900 px-6 py-3.5 rounded-full shadow-xl shadow-amber-500/25 flex items-center space-x-2 cursor-pointer border border-amber-300/80 font-black text-base tracking-wide transition-colors"
            >
              <UtensilsCrossed className="w-5 h-5 text-gray-900 stroke-[2.5]" />
              <span>开始做饭</span>
            </motion.button>
          </div>
        )}
      </div>
    );
  };

  // ==================== TAB 3: 动态日历与真实打卡记录页 ====================
  export const RecordView: React.FC = () => {
    const { cookingRecords, fetchCookingRecords, openInspiration } = useAppStore();

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const [selectedDate, setSelectedDate] = useState<string>(todayStr);
    const [currentYear, setCurrentYear] = useState<number>(now.getFullYear());
    const [currentMonth, setCurrentMonth] = useState<number>(now.getMonth() + 1);

    // 历史补录 Modal 状态
    const [isRetroModalOpen, setIsRetroModalOpen] = useState<boolean>(false);

    // 编辑做菜记录 Modal 状态
    const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
    const [editingRecord, setEditingRecord] = useState<CookingRecord | null>(null);

    useEffect(() => {
      fetchCookingRecords();
    }, [fetchCookingRecords]);

    // 补录或编辑保存成功后的时间穿透定位
    const handleRetroSuccess = async (retroDateStr: string) => {
      await fetchCookingRecords();
      setSelectedDate(retroDateStr);
      const parts = retroDateStr.split('-');
      if (parts.length === 3) {
        setCurrentYear(parseInt(parts[0], 10));
        setCurrentMonth(parseInt(parts[1], 10));
      }
    };

    // 月份导航切换与一键回到今天
    const handleGoToToday = () => {
      const tStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      setCurrentYear(now.getFullYear());
      setCurrentMonth(now.getMonth() + 1);
      setSelectedDate(tStr);
    };

    const handlePrevMonth = () => {
      if (currentMonth === 1) {
        setCurrentMonth(12);
        setCurrentYear((prev) => prev - 1);
      } else {
        setCurrentMonth((prev) => prev - 1);
      }
    };

    const handleNextMonth = () => {
      if (currentMonth === 12) {
        setCurrentMonth(1);
        setCurrentYear((prev) => prev + 1);
      } else {
        setCurrentMonth((prev) => prev + 1);
      }
    };

    // 原生 JS 动态计算当月网格
    const firstDayIndex = new Date(currentYear, currentMonth - 1, 1).getDay(); // 0 - 6
    const totalDaysInMonth = new Date(currentYear, currentMonth, 0).getDate(); // 28 - 31

    // 动态统计当前选定月份的做菜次数（与 currentYear & currentMonth 深度绑定）
    const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const monthRecords = cookingRecords.filter((r) => r.date?.startsWith(monthPrefix));
    const monthCount = monthRecords.length;

    // 最近做菜友好的中文描述（今天/昨天/X月X日，去除前导0）
    const getLatestDateDesc = () => {
      if (cookingRecords.length === 0) return '暂无记录';
      const sorted = [...cookingRecords].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      const latest = sorted[0]?.date;
      if (!latest) return '暂无记录';

      if (latest === todayStr) return '今天';
      
      const yesterday = new Date(now.getTime() - 86400000);
      const yestStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      if (latest === yestStr) return '昨天';
      
      const parts = latest.split('-');
      if (parts.length === 3) {
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        return `${m}月${d}日`;
      }
      return latest;
    };

    // 选中日期的明细标题友好转化
    const getSelectedDateTitle = () => {
      if (selectedDate === todayStr) return '今天 做菜明细';
      const yesterday = new Date(now.getTime() - 86400000);
      const yestStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
      if (selectedDate === yestStr) return '昨天 做菜明细';

      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        return `${m}月${d}日 做菜明细`;
      }
      return `${selectedDate} 做菜明细`;
    };

    // 获取选中日期的记录明细
    const selectedRecords = cookingRecords.filter((r) => r.date === selectedDate);

  return (
    <div className="flex-1 flex flex-col pb-[calc(10rem+env(safe-area-inset-bottom,0px))] pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] px-3.5 select-none">
      {/* 页面大标题 + 极简无干预统计 + 历史补录入口按键 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex flex-col">
          <h2 className="text-xl font-black text-gray-900 flex items-center">
            <span className="bg-[#FFC300] text-base p-1.5 rounded-xl mr-2.5 shadow-2xs">📅</span> 做菜记录
          </h2>
          <div className="text-[11px] font-bold text-gray-400 mt-1 pl-0.5 tracking-wide">
            本月开火 {monthCount} 次 · 最近 {getLatestDateDesc()}
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsRetroModalOpen(true)}
          className="px-3 py-1.5 bg-[#FFC300] hover:bg-amber-400 text-gray-900 font-black text-xs rounded-full shadow-2xs flex items-center space-x-1 cursor-pointer transition-all border border-amber-300/80 shrink-0"
          title="补录遗漏的做菜打卡"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>补录</span>
        </motion.button>
      </div>

      {/* 动态日历面板 (紧凑瘦身) */}
      <div className="bg-white rounded-2xl shadow-2xs border border-gray-100 p-3 mb-2.5">
        {/* 月份导航与快捷回到今天 */}
        <div className="flex justify-between items-center mb-2">
          <button
            onClick={handlePrevMonth}
            className="text-gray-400 hover:text-gray-800 font-bold text-xs p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
          >
            ◀
          </button>

          <div className="flex items-center space-x-2">
            <span className="font-black text-sm text-gray-900">
              {currentYear}年 {currentMonth}月
            </span>
            {(selectedDate !== todayStr || currentYear !== now.getFullYear() || currentMonth !== (now.getMonth() + 1)) && (
              <motion.button
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleGoToToday}
                className="px-2 py-0.5 bg-[#FFC300] hover:bg-amber-400 text-gray-900 font-black text-[10px] rounded-full shadow-2xs transition-all cursor-pointer border border-amber-300/80"
                title="一键返回今天"
              >
                📍 今天
              </motion.button>
            )}
          </div>

          <button
            onClick={handleNextMonth}
            className="text-gray-400 hover:text-gray-800 font-bold text-sm p-1 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
          >
            ▶
          </button>
        </div>

        {/* 星期 Header */}
        <div className="grid grid-cols-7 gap-1 text-center text-gray-400 text-[11px] font-bold mb-1.5">
          <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
        </div>

        {/* 日历 7x5 / 7x6 矩阵 (压缩行距 gap-y-1) */}
        <div className="grid grid-cols-7 gap-y-1 gap-x-1 text-center text-xs font-bold text-gray-800">
          {/* 前置空白占位 */}
          {Array.from({ length: firstDayIndex }).map((_, i) => (
            <span key={`empty_${i}`} className="text-transparent">0</span>
          ))}

          {/* 当月日期渲染 */}
          {Array.from({ length: totalDaysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const isSelected = dateStr === selectedDate;
            const hasRecord = cookingRecords.some((r) => r.date === dateStr);

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`relative w-7.5 h-7.5 rounded-full flex items-center justify-center mx-auto transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-gray-900 text-[#FFC300] font-black shadow-xs scale-105'
                    : 'text-gray-800 hover:bg-gray-100'
                }`}
              >
                <span>{dayNum}</span>
                
                {/* 做菜打卡成就感视觉标识 */}
                {hasRecord && (
                  <div
                    className={`w-1.5 h-1.5 rounded-full absolute -bottom-0.5 left-1/2 -translate-x-1/2 transition-colors ${
                      isSelected ? 'bg-[#FFC300]' : 'bg-emerald-500 shadow-2xs'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 选定日期的明细卡片与空状态 (精美紧凑布局) */}
      <div className="bg-white rounded-2xl p-3 shadow-2xs border border-gray-100">
        <div className="text-xs font-bold text-gray-400 mb-2 flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#FFC300]" />
            <span className="text-gray-900 font-extrabold text-xs">{getSelectedDateTitle()}</span>
          </div>
          {selectedDate !== todayStr ? (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={handleGoToToday}
              className="bg-[#FFC300] hover:bg-amber-400 text-gray-900 text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-2xs cursor-pointer flex items-center space-x-0.5 border border-amber-300/80 transition-colors"
              title="一键回到今天明细"
            >
              <span>📍 回到今天</span>
            </motion.button>
          ) : (
            <span className="bg-[#FFC300]/20 text-gray-900 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300/40">
              TODAY
            </span>
          )}
        </div>

        {selectedRecords.length === 0 ? (
          <div className="py-5 text-center text-gray-400 flex flex-col items-center justify-center">
            <span className="text-xl mb-1">🍳</span>
            <span className="text-xs font-bold mb-2.5">这天家里没有开火打卡哦~</span>
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setIsRetroModalOpen(true)}
              className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-full transition-colors flex items-center space-x-1 cursor-pointer border border-gray-200"
            >
              <Plus className="w-3.5 h-3.5 text-[#FFC300] stroke-[3]" />
              <span>补录这天记录</span>
            </motion.button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {selectedRecords.map((rec, recIdx) => {
              try {
                let rawDishes: any[] = [];
                if (Array.isArray(rec.dishes)) {
                  rawDishes = rec.dishes;
                } else if (typeof rec.dishes === 'string') {
                  rawDishes = JSON.parse(rec.dishes);
                }

                const adultDishes = rawDishes.filter((d: any) => d?.target_user === 'adult');
                const babyDishes = rawDishes.filter((d: any) => d?.target_user === 'baby');

                return (
                  <div
                    key={rec.id || `rec_${recIdx}`}
                    className="p-2.5 bg-gray-50/60 rounded-xl border border-gray-100 shadow-2xs relative space-y-1.5 group text-left"
                  >
                    {/* 记录区块顶栏：编辑入口图标按钮 */}
                    <div className="flex items-center justify-between text-xs pb-1 border-b border-gray-100/80">
                      <span className="text-gray-400 font-extrabold text-[10px]">
                        餐次记录 #{recIdx + 1}
                      </span>
                      
                      <button
                        onClick={() => {
                          setEditingRecord(rec);
                          setIsEditModalOpen(true);
                        }}
                        className="text-[10px] text-gray-500 hover:text-gray-900 font-bold px-2 py-0.5 rounded-md bg-white border border-gray-200 shadow-2xs hover:bg-gray-100 transition-colors flex items-center space-x-1 cursor-pointer"
                        title="编辑此条打卡记录"
                      >
                        <Edit3 className="w-3 h-3 text-[#FFC300]" />
                        <span>编辑</span>
                      </button>
                    </div>

                    {adultDishes.length > 0 && (
                      <div className="bg-white p-2 rounded-lg border border-gray-100">
                        <div className="text-[11px] font-bold text-gray-400 mb-1 flex justify-between items-center">
                          <span>👨‍👩‍👦 大人吃</span>
                          {rec.rating && (
                            <div className="flex items-center space-x-0.5">
                              {Array.from({ length: rec.rating }).map((_, i) => (
                                <Star key={i} className="w-3 h-3 text-[#FFC300] fill-[#FFC300]" />
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {adultDishes.map((dish: any, idx: number) => (
                            <span key={idx} className="text-[11px] font-bold text-gray-800 bg-gray-50 px-2 py-0.5 rounded-md border border-gray-200 shadow-2xs">
                              {dish.thumbnail || '🍳'} {dish.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {babyDishes.length > 0 && (
                      <div className="bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                        <div className="text-[11px] font-bold text-amber-600 mb-1">👶 等等吃</div>
                        <div className="flex flex-wrap gap-1">
                          {babyDishes.map((dish: any, idx: number) => (
                            <span key={idx} className="text-[11px] font-bold text-gray-800 bg-white px-2 py-0.5 rounded-md border border-amber-200/60 shadow-2xs">
                              {dish.thumbnail || '🥣'} {dish.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {rec.note && (
                      <div className="text-[11px] text-gray-500 bg-white p-2 rounded-lg border border-gray-100">
                        💬 <span className="font-bold">{rec.note}</span>
                      </div>
                    )}
                  </div>
                );
              } catch (err) {
                console.error('解析做菜明细快照异常:', err);
                return (
                  <div key={rec.id} className="text-xs text-gray-400 py-2 text-center">
                    数据读取异常
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>

      {/* 扩展功能容器 (Flex 容器，横向排列正方形快捷按钮) */}
      <div className="mt-3 flex items-center space-x-3">
        <motion.button
          whileTap={{ scale: 0.93 }}
          whileHover={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          onClick={openInspiration}
          className="w-20 h-20 bg-white rounded-2xl border border-gray-100 shadow-2xs flex flex-col items-center justify-center p-2 cursor-pointer hover:bg-amber-50/60 hover:border-amber-200 transition-all select-none group shrink-0"
          title="看菜做饭"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-100/60 text-amber-800 flex items-center justify-center mb-1.5 group-hover:bg-[#FFC300] group-hover:text-gray-900 transition-colors shadow-inner">
            <Search className="w-4.5 h-4.5 stroke-[2.5]" />
          </div>
          <span className="text-xs font-black text-gray-800 group-hover:text-gray-900">看菜做饭</span>
        </motion.button>
      </div>

      {/* 历史补录 Modal 弹窗组件 */}
      <RetroactiveLogModal
        isOpen={isRetroModalOpen}
        onClose={() => setIsRetroModalOpen(false)}
        onSuccess={handleRetroSuccess}
      />

      {/* 编辑打卡记录 Modal 弹窗组件 */}
      <EditCookingRecordModal
        isOpen={isEditModalOpen}
        record={editingRecord}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingRecord(null);
        }}
        onSuccess={handleRetroSuccess}
      />

      {/* 底部 TabBar 安全防遮挡垫片 */}
      <div className="h-28 w-full shrink-0 pointer-events-none" />
    </div>
  );
};
