import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, PartyPopper, Star, X } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getStepImageUrl } from '../utils/imageHelper';

export const CookingModal: React.FC = () => {
  const {
    isCookingOpen,
    closeCooking,
    prepList,
    addCookingRecord,
    clearPrepList,
    setActiveTab,
  } = useAppStore();

  const [currentRecipeIdx, setCurrentRecipeIdx] = useState(0);

  // 1. 屏幕常亮 (Wake Lock API)
  useEffect(() => {
    if (!isCookingOpen) return;

    let wakeLock: any = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) {
        console.warn('Wake Lock request error:', err);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock && typeof wakeLock.release === 'function') {
        wakeLock.release().catch(() => {});
      }
    };
  }, [isCookingOpen]);

  // 2. 退出二次确认 Modal State
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // 3. 局部快捷计时器 State
  const [timerSeconds, setTimerSeconds] = useState(60); // 默认初始 01:00 (1分钟)
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // 4. 打卡完成弹窗 State
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isTimerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setIsTimerRunning(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning, timerSeconds]);

  if (!isCookingOpen || prepList.length === 0) return null;

  const currentRecipe = prepList[currentRecipeIdx] || prepList[0];
  const steps = currentRecipe?.steps && currentRecipe.steps.length > 0
    ? currentRecipe.steps
    : ['按照喜好切块并调制底料', '热油下锅翻炒至熟透发香', '出锅装盘享受美味吧！'];

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const addTimerMinutes = (mins: number) => {
    setTimerSeconds((prev) => prev + mins * 60);
  };

  const handleCompleteSubmit = async () => {
    setIsSubmitted(true);

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const newRecord = {
      id: `rec_${Date.now()}`,
      date: todayStr,
      dishes: prepList.map((r) => ({
        id: r.id,
        name: r.name || '美味菜品',
        thumbnail: r.thumbnail || (r.target_user === 'baby' ? '🥣' : '🍳'),
        target_user: r.target_user || 'adult',
      })),
      rating: rating,
      note: feedback.trim() || undefined,
      created: now.toISOString(),
    };

    await addCookingRecord(newRecord);

    setTimeout(() => {
      setIsSubmitted(false);
      setShowFinishModal(false);
      clearPrepList();
      closeCooking();
      setActiveTab('record');
    }, 1200);
  };

  const handleCloseCooking = () => {
    setShowExitConfirm(true);
  };

  const confirmExitCooking = () => {
    setShowExitConfirm(false);
    closeCooking();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-0 z-50 bg-gray-900 flex flex-col font-sans select-none overflow-hidden text-gray-100"
      >
        {/* Sticky 吸顶控制区：结合退出按钮、菜品 Tabs、瘦身倒计时器 */}
        <div className="sticky top-0 z-40 bg-gray-900/95 backdrop-blur-md border-b border-gray-800 px-3 pt-[calc(env(safe-area-inset-top,44px)+0.5rem)] pb-2.5 shadow-xl shrink-0 space-y-2">
          {/* TopBar 顶栏：退出按钮 + 菜品 Tabs */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleCloseCooking}
              className="w-10 h-10 bg-gray-800 hover:bg-gray-700 text-gray-100 rounded-full font-black flex items-center justify-center transition-colors mr-2.5 shrink-0 cursor-pointer shadow-2xs"
              title="退出做饭"
            >
              <X className="w-5 h-5 stroke-[2.5]" />
            </button>

            <div className="flex-1 flex space-x-2 overflow-x-auto no-scrollbar py-1">
              {prepList.map((item, idx) => {
                const isActive = idx === currentRecipeIdx;
                return (
                  <button
                    key={item.id || `prep_${item.name || ''}_${idx}`}
                    onClick={() => setCurrentRecipeIdx(idx)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all flex items-center space-x-1.5 cursor-pointer shrink-0 ${
                      isActive
                        ? 'bg-[#FFC300] text-gray-900 font-extrabold shadow-sm'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    <span>{item.thumbnail || (item.target_user === 'baby' ? '🥣' : '🍳')}</span>
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 瘦身型 Timer 计时器模块 */}
          <div className="flex justify-center w-full">
            <div className="flex flex-row items-center justify-between bg-gray-800/90 border border-gray-700/80 rounded-full px-4 py-1.5 w-[94%] max-w-sm shadow-xl">
              {/* 左侧：倒计时大字 */}
              <div className="font-mono text-2xl font-black text-[#FFC300] tracking-wider shrink-0 mr-1">
                {formatTimer(timerSeconds)}
              </div>

              {/* 中间：加时按钮 [+1分] [+5分] */}
              <div className="flex space-x-1 mx-1 shrink-0">
                <button
                  onClick={() => addTimerMinutes(1)}
                  className="h-8 px-2.5 bg-gray-700 hover:bg-gray-600 text-xs font-extrabold rounded-full text-gray-100 active:scale-95 transition-transform flex items-center justify-center cursor-pointer"
                >
                  +1分
                </button>
                <button
                  onClick={() => addTimerMinutes(5)}
                  className="h-8 px-2.5 bg-gray-700 hover:bg-gray-600 text-xs font-extrabold rounded-full text-gray-100 active:scale-95 transition-transform flex items-center justify-center cursor-pointer"
                >
                  +5分
                </button>
              </div>

              {/* 右侧：圆形的 Play/Pause 与 Reset 按钮 */}
              <div className="flex items-center space-x-1.5 shrink-0">
                <button
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                  className={`w-8 h-8 rounded-full font-bold flex items-center justify-center transition-all active:scale-90 shadow-md cursor-pointer ${
                    isTimerRunning
                      ? 'bg-amber-500 text-gray-900'
                      : 'bg-[#FFC300] text-gray-900 hover:brightness-105'
                  }`}
                  title={isTimerRunning ? '暂停' : '开始'}
                >
                  {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                </button>

                <button
                  onClick={() => {
                    setIsTimerRunning(false);
                    setTimerSeconds(60);
                  }}
                  className="w-8 h-8 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-full font-bold flex items-center justify-center active:scale-90 transition-all cursor-pointer"
                  title="重置"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 垂直瀑布流步骤展示区（一览无余滑动体验） */}
        <div className="flex-1 overflow-y-auto px-4 pt-5 pb-[calc(4rem+env(safe-area-inset-bottom))] space-y-6 max-w-xl mx-auto w-full no-scrollbar">
          {steps.map((step, index) => {
            const stepContent = typeof step === 'string'
              ? step
              : (step as { content?: string; image?: string })?.content || '';
            const stepImgUrl = getStepImageUrl(currentRecipe, step);

            return (
              <div
                key={`step_${index}`}
                className="bg-gray-800/80 border border-gray-700/80 rounded-3xl p-5 shadow-lg flex flex-col space-y-4"
              >
                {/* 步骤标头 */}
                <div className="flex items-center justify-between">
                  <span className="px-3.5 py-1 bg-[#FFC300]/15 text-[#FFC300] font-black text-xs rounded-full border border-[#FFC300]/30 tracking-wide">
                    步骤 {index + 1} / {steps.length}
                  </span>
                </div>

                {/* 巨型醒目步骤文本 */}
                <p className="text-xl font-extrabold text-white leading-relaxed tracking-wide text-left">
                  {stepContent}
                </p>

                {/* 步骤大图 */}
                {stepImgUrl && (
                  <div className="w-full mt-2 rounded-2xl overflow-hidden shadow-md border border-gray-700/80">
                    <img
                      src={stepImgUrl}
                      loading="lazy"
                      className="w-full max-h-72 object-cover"
                      alt={`步骤 ${index + 1} 图片`}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* 瀑布流最底端：【✅ 完成，打卡！】巨型按钮 */}
          <div className="pt-4 pb-10 text-center">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => setShowFinishModal(true)}
              className="w-full py-4 rounded-2xl bg-[#FFC300] hover:bg-amber-400 text-gray-900 font-black text-lg shadow-xl active:scale-98 transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <PartyPopper className="w-6 h-6" />
              <span>✅ 完成，打卡！</span>
            </motion.button>
          </div>
        </div>

        {/* 5星打卡完成 Modal */}
        {showFinishModal && (
          <div className="fixed inset-0 bg-gray-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl text-center border border-gray-100 relative overflow-hidden"
            >
              <button
                onClick={() => setShowFinishModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 font-bold cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-16 h-16 bg-amber-100/60 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl shadow-inner">
                🎉
              </div>

              <h3 className="text-xl font-black text-gray-900 mb-1">大功告成，享受美味！</h3>
              <p className="text-xs text-gray-400 mb-5">记录一下今天的做菜心得吧</p>

              {/* 5星评分 */}
              <div className="flex justify-center space-x-2 mb-5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className="cursor-pointer focus:outline-none transition-transform active:scale-125"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= rating
                          ? 'text-[#FFC300] fill-[#FFC300]'
                          : 'text-gray-200 fill-gray-100'
                      }`}
                    />
                  </button>
                ))}
              </div>

              {/* 心得输入框 */}
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="给今天的菜打个总结吧（选填，例如：咸淡正好，宝宝很喜欢吃！）"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-3 text-xs text-gray-800 outline-none focus:border-[#FFC300] h-20 resize-none mb-5 font-bold"
              />

              <button
                onClick={handleCompleteSubmit}
                disabled={isSubmitted}
                className="w-full py-3 bg-[#FFC300] hover:bg-amber-400 text-gray-900 font-black text-sm rounded-full shadow-md active:scale-95 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isSubmitted ? (
                  <span>🎉 打卡保存中...</span>
                ) : (
                  <span>✅ 打卡，开饭！</span>
                )}
              </button>
            </motion.div>
          </div>
        )}

        {/* 沉浸式暗黑二次确认退出 Modal */}
        {showExitConfirm && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 border border-gray-700/80 rounded-3xl p-6 w-full max-w-xs shadow-2xl text-center"
            >
              <div className="w-14 h-14 bg-amber-500/20 text-[#FFC300] rounded-full flex items-center justify-center mx-auto mb-3 text-2xl border border-amber-500/30">
                🍳
              </div>

              <h4 className="text-lg font-black text-white mb-1">正在做饭中，确定退出吗？</h4>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                退出后将暂停烹饪倒计时与当前卡片进度
              </p>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-gray-200 font-extrabold text-sm rounded-2xl transition-colors cursor-pointer"
                >
                  继续做饭
                </button>
                <button
                  onClick={confirmExitCooking}
                  className="flex-1 py-3 bg-[#FFC300] hover:bg-amber-400 text-gray-900 font-black text-sm rounded-2xl shadow-md transition-colors cursor-pointer"
                >
                  确定退出
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
