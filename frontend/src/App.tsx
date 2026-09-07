import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Utensils, ShoppingCart, CalendarDays } from 'lucide-react';
import type { TabType } from './types';
import { RecipeView, PrepView, RecordView } from './components/Views';
import { CookingModal } from './components/CookingModal';
import { AddRecipeModal } from './components/AddRecipeModal';
import { RecipeDetailModal } from './components/RecipeDetailModal';
import { InspirationView } from './components/InspirationView';
import { useAppStore } from './store/useAppStore';

export const App: React.FC = () => {
  const { activeTab, setActiveTab, prepList, fetchCookingRecords, fetchPantryList } = useAppStore();

  useEffect(() => {
    fetchCookingRecords();
    fetchPantryList();
  }, [fetchCookingRecords, fetchPantryList]);

  const navTabs = [
    { id: 'recipe' as TabType, label: '菜谱', icon: Utensils },
    { id: 'prep' as TabType, label: '备菜', icon: ShoppingCart, count: prepList.length },
    { id: 'record' as TabType, label: '探索', icon: CalendarDays },
  ];

  return (
    <div className="bg-polka flex justify-center items-center min-h-screen font-sans text-gray-800 antialiased selection:bg-[#FFC300]">
      {/* 全局响应式移动端主容器 */}
      <main className="w-full max-w-md bg-[#F7F8FA] shadow-2xl relative flex flex-col h-screen overflow-hidden border-x border-gray-200/80">
        
        {/* Tab 视图切页与 Framer Motion 物理过渡 */}
        <div className="flex-1 flex flex-col overflow-y-auto relative no-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.99 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex-1 flex flex-col min-h-full"
            >
              {activeTab === 'recipe' && <RecipeView />}
              {activeTab === 'prep' && <PrepView />}
              {activeTab === 'record' && <RecordView />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 底部 TabBar: 全宽沉底停靠模式 (Docked TabBar) */}
        <nav
          onTouchMove={(e) => e.stopPropagation()}
          className="fixed bottom-0 left-0 right-0 w-full max-w-md mx-auto bg-white/90 backdrop-blur-lg border-t border-gray-200/80 rounded-t-3xl pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] px-3 z-30 shadow-[0_-4px_10px_-1px_rgba(0,0,0,0.05)] touch-none select-none"
        >
          <div className="flex justify-around items-center relative">
            {navTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex flex-col items-center justify-center py-2 px-6 relative z-10 focus:outline-none cursor-pointer group select-none"
                >
                  {/* 高亮背景 Indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="navTabIndicator"
                      className="absolute inset-0 bg-[#FFC300]/25 rounded-xl -z-10"
                      transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    />
                  )}

                  <div className="relative">
                    <Icon
                      className={`w-6 h-6 transition-all duration-200 ${
                        isActive
                          ? 'text-gray-900 scale-110'
                          : 'text-gray-400 group-hover:text-gray-600'
                      }`}
                    />
                    {/* Badge 动画数量提示 */}
                    {tab.count !== undefined && tab.count > 0 && (
                      <motion.span
                        key={tab.count}
                        initial={{ scale: 0.5 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1.5 -right-2.5 bg-gray-900 text-[#FFC300] text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center border border-white shadow-xs"
                      >
                        {tab.count}
                      </motion.span>
                    )}
                  </div>

                  <span
                    className={`text-xs font-extrabold mt-1 transition-colors duration-200 ${
                      isActive ? 'text-gray-900 font-black' : 'text-gray-400'
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* 全屏【沉浸做饭模式 (Dark Mode)】Modal */}
        <CookingModal />

        {/* 全屏【添加新菜】Modal */}
        <AddRecipeModal />

        {/* 全屏【菜谱详情页】Modal */}
        <RecipeDetailModal />

        {/* 全屏【寻味看菜下饭】Modal */}
        <InspirationView />
      </main>
    </div>
  );
};

export default App;
