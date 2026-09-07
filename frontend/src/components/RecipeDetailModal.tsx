import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trash2, Heart, ShoppingBag, Check, AlertCircle, ZoomIn, CheckCircle2, Pencil } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getRecipeThumbnailUrl, getStepImageUrl } from '../utils/imageHelper';
import { normalizeIngredients, getCalorieBadge } from '../utils/recipeHelper';

export const RecipeDetailModal: React.FC = () => {
  const {
    selectedRecipe,
    closeRecipeDetail,
    deleteRecipe,
    openEditModal,
    addToPrep,
    removeFromPrep,
    isInPrep,
  } = useAppStore();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    let wakeLock: any = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
          console.info('🍳 厨房阅读常亮模式已自动激活 (Screen Wake Lock Active)');
        }
      } catch (err) {
        console.warn('Wake Lock 请求未被授权或浏览器不支持:', err);
      }
    };

    requestWakeLock();

    return () => {
      if (wakeLock) {
        wakeLock.release().then(() => {
          console.info('厨房常亮唤醒锁已安全释放');
        }).catch(() => {});
      }
    };
  }, []);

  if (!selectedRecipe) return null;

  const added = isInPrep(selectedRecipe.id);
  const isFav = selectedRecipe.is_favorite || (selectedRecipe.tag && selectedRecipe.tag.includes('爱吃'));
  const thumbInfo = getRecipeThumbnailUrl(selectedRecipe);

  const handleTogglePrep = () => {
    if (added) {
      removeFromPrep(selectedRecipe.id);
    } else {
      addToPrep(selectedRecipe);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteRecipe(selectedRecipe.id);
      setShowDeleteConfirm(false);
      setToastMsg('🗑️ 菜谱已成功删除！');
      setTimeout(() => {
        setToastMsg(null);
        closeRecipeDetail();
      }, 1000);
    } catch (err: any) {
      console.error('Delete Recipe Error:', err);
      alert(`删除失败: ${err?.message || '请检查 PocketBase 服务连接'}`);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 320 }}
        className="fixed inset-0 z-[70] bg-[#F7F8FA] flex flex-col overflow-y-auto font-sans select-none"
      >
        {/* 删除结果 Toast */}
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-[#FFC300] px-4 py-2.5 rounded-full shadow-xl text-xs font-black flex items-center space-x-2 border border-gray-800"
          >
            <CheckCircle2 className="w-4 h-4 text-[#FFC300]" />
            <span>{toastMsg}</span>
          </motion.div>
        )}

        {/* 吸顶 Glassmorphic 头部导航栏 (Sticky Top Bar) */}
        <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100/90 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+1rem)] shadow-xs flex justify-between items-center">
          <motion.button
            whileTap={{ scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            onClick={closeRecipeDetail}
            className="w-11 h-11 bg-gray-100/90 hover:bg-gray-200 text-gray-800 rounded-full flex items-center justify-center shadow-2xs transition-colors cursor-pointer"
            title="返回菜谱列表"
          >
            <ArrowLeft className="w-6 h-6 stroke-[2.5]" />
          </motion.button>

          <div className="flex space-x-2.5">
            <motion.button
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={() => {
                openEditModal(selectedRecipe);
                closeRecipeDetail();
              }}
              className="w-11 h-11 bg-gray-100/90 hover:bg-amber-100 text-gray-800 hover:text-amber-900 rounded-full flex items-center justify-center shadow-2xs transition-colors cursor-pointer"
              title="编辑菜谱"
            >
              <Pencil className="w-5 h-5 stroke-[2.2]" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={() => setShowDeleteConfirm(true)}
              className="w-11 h-11 bg-gray-100/90 hover:bg-red-50 text-red-500 rounded-full flex items-center justify-center shadow-2xs transition-colors cursor-pointer"
              title="删除菜谱"
            >
              <Trash2 className="w-5 h-5 stroke-[2.2]" />
            </motion.button>
          </div>
        </div>

        {/* 紧凑型 Hero 信息区 (大幅压缩垂直高度) */}
        <div className="relative bg-gradient-to-b from-amber-50/70 to-[#F7F8FA] pt-4 pb-4 px-4 border-b border-amber-100/40">
          <div className="flex items-center space-x-4">
            {/* 封面图/Emoji (尺寸收紧至 w-16 h-16) */}
            <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-4xl shadow-sm border border-amber-100 relative overflow-hidden shrink-0">
              {thumbInfo.isImage ? (
                <img src={thumbInfo.value} alt={selectedRecipe.name} loading="lazy" className="w-full h-full object-cover" />
              ) : (
                <span>{thumbInfo.value}</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-black text-gray-900 tracking-wide truncate flex items-center">
                <span>{selectedRecipe.name}</span>
                {isFav && (
                  <Heart className="w-4 h-4 text-red-500 fill-red-500 ml-1.5 shrink-0" />
                )}
              </h1>

              {(() => {
                const calBadge = getCalorieBadge(selectedRecipe.calorie_density, selectedRecipe.target_user);
                return (
                  <div className="flex flex-wrap gap-1.5 mt-1.5 items-center">
                    <span className="bg-[#FFC300] text-gray-900 text-xs font-black px-2.5 py-0.5 rounded-full shadow-2xs">
                      {selectedRecipe.target_user === 'adult' ? '👨‍👩‍👦 大人吃' : '👶 等等吃'}
                    </span>
                    <span className="bg-white text-gray-700 border border-gray-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
                      {selectedRecipe.category || '未分类'}
                    </span>
                    {/* 极简卡路里交通灯标签 (数据库直读) */}
                    {calBadge && (
                      <span className={`text-xs px-2.5 py-0.5 rounded-full border truncate ${calBadge.badgeStyle}`}>
                        {calBadge.label}
                      </span>
                    )}
                    {selectedRecipe.tag && selectedRecipe.tag.trim() !== '' && (
                      <span className="bg-amber-100 text-amber-900 text-xs font-extrabold px-2.5 py-0.5 rounded-full border border-amber-200/60 truncate">
                        {selectedRecipe.tag}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* 二次确认删除 Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-5 w-full max-w-xs shadow-2xl border border-gray-100 text-center">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-2" />
              <h4 className="text-base font-black text-gray-900 mb-1">确定要删除该菜谱吗？</h4>
              <p className="text-xs text-gray-500 mb-4">删除后数据将无法恢复。</p>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold text-sm rounded-xl hover:bg-gray-200 cursor-pointer"
                >
                  取消
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2.5 bg-red-500 text-white font-bold text-sm rounded-xl hover:bg-red-600 shadow-xs cursor-pointer"
                >
                  确定删除
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 大图全屏缩放 Preview Modal */}
        {zoomImage && (
          <div
            onClick={() => setZoomImage(null)}
            className="fixed inset-0 bg-gray-950/90 z-50 flex items-center justify-center p-4 cursor-zoom-out"
          >
            <img src={zoomImage} alt="Step preview" className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl" />
          </div>
        )}

        {/* 主体内容区 (高对比度、大字号适老化) */}
        <div className="p-4 space-y-4 pb-[calc(8rem+env(safe-area-inset-bottom))]">
          {/* 食材与用量区 */}
          <div className="bg-white p-4.5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-black text-gray-900 mb-3 flex items-center">
              <span className="bg-amber-100 text-amber-800 text-sm p-1.5 rounded-lg mr-2">🛒</span> 食材准备
            </h3>
            
            {(() => {
              const ingredientsList = normalizeIngredients(selectedRecipe.ingredients);
              return ingredientsList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ingredientsList.map((ing, i) => (
                    <div key={`ing_${ing.name}_${i}`} className="bg-gray-50 p-3 rounded-xl border border-gray-200/70 flex items-center justify-between space-x-2 text-base">
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-[#FFC300] shrink-0" />
                        <span className="font-extrabold text-gray-900 truncate">{ing.name}</span>
                      </div>
                      {ing.amount && (
                        <span className="text-xs font-extrabold text-amber-900/90 bg-amber-100/70 px-2 py-0.5 rounded-md border border-amber-200/60 shrink-0">
                          {ing.amount}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-400 py-2 font-bold">无特定食材标注</div>
              );
            })()}
          </div>

          {/* 做法步骤区 */}
          <div className="bg-white p-4.5 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-black text-gray-900 mb-3 flex items-center">
              <span className="bg-amber-100 text-amber-800 text-sm p-1.5 rounded-lg mr-2">🍳</span> 烹饪步骤
            </h3>

            {selectedRecipe.steps && selectedRecipe.steps.length > 0 ? (
              <div className="space-y-4">
                {selectedRecipe.steps.map((st, idx) => {
                  const contentText = typeof st === 'string' ? st : st.content;
                  const stepImgUrl = getStepImageUrl(selectedRecipe, st);

                  return (
                    <div key={`step_${idx}`} className="bg-gray-50/90 p-4 rounded-2xl border border-gray-200/80 space-y-3">
                      {/* 醒目放大 STEP 标识标签 */}
                      <div className="flex items-center space-x-2">
                        <span className="bg-[#FFC300] text-gray-900 text-xs font-black px-3 py-1 rounded-lg border border-amber-300 shadow-2xs">
                          STEP {idx + 1}
                        </span>
                      </div>
                      
                      {/* 高对比度、大字号、充足行高步骤文本 */}
                      <p className="text-lg font-extrabold text-gray-900 leading-relaxed sm:leading-loose tracking-wide">
                        {contentText}
                      </p>

                      {/* 步骤大图 (通过 getStepImageUrl 解析物理文件，支持点击放大) */}
                      {stepImgUrl && (
                        <div
                          onClick={() => setZoomImage(stepImgUrl)}
                          className="relative mt-2 rounded-xl overflow-hidden cursor-zoom-in group max-h-56 border border-gray-200 shadow-xs"
                        >
                          <img src={stepImgUrl} alt={`Step ${idx + 1}`} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          <div className="absolute bottom-2 right-2 bg-gray-900/70 text-white px-2 py-1 rounded-md text-xs font-bold flex items-center space-x-1 backdrop-blur-xs">
                            <ZoomIn className="w-3.5 h-3.5" />
                            <span>点击放大</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm text-gray-400 py-2 font-bold">暂无步骤描述</div>
            )}
          </div>
        </div>

        {/* 右下角 Floating Action Button (FAB) 悬浮组件 */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          onClick={handleTogglePrep}
          className={`fixed bottom-8 right-6 z-40 px-5 py-3.5 rounded-full font-black text-base shadow-2xl flex items-center space-x-2 border transition-all cursor-pointer ${
            added
              ? 'bg-gray-900 text-[#FFC300] border-gray-800 shadow-gray-900/30'
              : 'bg-[#FFC300] text-gray-900 border-amber-300 shadow-amber-500/40 hover:brightness-105'
          }`}
        >
          {added ? (
            <>
              <Check className="w-5 h-5 stroke-[3]" />
              <span>已加清单</span>
            </>
          ) : (
            <>
              <ShoppingBag className="w-5 h-5 stroke-[2.5]" />
              <span>加入清单</span>
            </>
          )}
        </motion.button>
      </motion.div>
    </AnimatePresence>
  );
};
