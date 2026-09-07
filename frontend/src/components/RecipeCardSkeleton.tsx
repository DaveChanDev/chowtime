import React from 'react';

/**
 * 菜谱列表单项骨架屏
 */
export const RecipeCardSkeleton: React.FC = () => {
  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-gray-100 animate-pulse">
      <div className="flex items-center space-x-4 min-w-0 flex-1">
        {/* 占位封面图区域 */}
        <div className="w-14 h-14 bg-gray-200 rounded-2xl shrink-0" />
        
        {/* 占位标题和分类标签 */}
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-gray-200 rounded-md w-2/5" />
          <div className="flex items-center space-x-2">
            <div className="h-4 bg-gray-200 rounded-md w-12" />
            <div className="h-4 bg-gray-200 rounded-md w-16" />
          </div>
        </div>
      </div>

      {/* 右侧操作按钮占位 */}
      <div className="w-10 h-10 bg-gray-200 rounded-full shrink-0 ml-3" />
    </div>
  );
};

/**
 * 备菜页 Loading 同步骨架屏 (包含菜品区与食材汇总闪烁横线)
 */
export const PrepSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 animate-pulse">
      {/* 待做菜品卡片骨架 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="h-4 bg-gray-200 rounded w-28 mb-3" />
        <div className="space-y-2.5">
          <div className="h-14 bg-gray-100 rounded-xl" />
          <div className="h-14 bg-gray-100 rounded-xl" />
        </div>
      </div>

      {/* 需备食材汇总骨架 (闪烁灰色横线) */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <div className="h-5 bg-gray-200 rounded w-36 mb-4" />
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-4/5" />
          <div className="h-4 bg-gray-200 rounded w-3/5" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    </div>
  );
};
