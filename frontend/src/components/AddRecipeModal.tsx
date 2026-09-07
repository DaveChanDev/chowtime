import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Plus, X, Heart, Sparkles, CheckCircle2, AlertCircle, ImagePlus } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { getRecipeThumbnailUrl, getStepImageUrl } from '../utils/imageHelper';
import { normalizeIngredients } from '../utils/recipeHelper';
import { correctIngredientsText } from '../utils/ingredientAliasData';
import { ImageCropperModal } from './ImageCropperModal';
import { compressImage } from '../utils/imageCompressor';
import type { TargetUser, RecipeRecord } from '../types';

interface StepItem {
  id: string;
  content: string;
  image?: string;
  image_index?: number;
}

export const AddRecipeModal: React.FC = () => {
  const { isAddModalOpen, closeAddModal, addRecipe, updateRecipe, editingRecipe } = useAppStore();

  // AI 解析折叠面板与 State
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [aiJsonInput, setAiJsonInput] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 防误触取消确认 Modal State
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // 表单核心 Local State
  const [name, setName] = useState('');
  const [targetGroup, setTargetGroup] = useState<TargetUser>('adult');
  const [category, setCategory] = useState('荤菜');
  const [thumbnail, setThumbnail] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [ingredientsText, setIngredientsText] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const [steps, setSteps] = useState<StepItem[]>([
    { id: 'step_1', content: '' },
  ]);

  const normalizedTag = tagInput.trim();
  const isTagValid = true;

  const handleTagInputChange = (val: string) => {
    setTagInput(val);
  };

  // 监听菜名输入，包含关键词时自动将 target_user 设置为 baby
  const handleNameChange = (val: string) => {
    setName(val);
    if (/(辅食|宝宝|婴儿|幼龄|儿童)/.test(val)) {
      setTargetGroup('baby');
      if (category === '荤菜' || category === '素菜' || category === '凉菜' || category === '汤羹') {
        setCategory('饭面主食');
      }
    }
  };

  // 记录已回填的菜谱 ID，避免重复触发表单重置覆盖用户输入
  const prevEditingIdRef = React.useRef<string | null>(null);

  // 编辑模式下自动填充回显当前菜谱数据 (仅在 editingRecipe ID 变化时触发回填)
  React.useEffect(() => {
    const currentId = editingRecipe?.id || null;
    if (currentId !== prevEditingIdRef.current) {
      prevEditingIdRef.current = currentId;

      if (editingRecipe) {
        setName(editingRecipe.name || '');
        setTargetGroup(editingRecipe.target_user || 'adult');
        setCategory(editingRecipe.category || '荤菜');
        setThumbnail(editingRecipe.thumbnail || '');
        setTagInput(editingRecipe.tag || '');
        setIsFavorite(Boolean(editingRecipe.is_favorite || (editingRecipe.tag && editingRecipe.tag.includes('爱吃'))));

        const thumbInfo = getRecipeThumbnailUrl(editingRecipe);
        if (thumbInfo.isImage) {
          setCoverPreview(thumbInfo.value);
        } else {
          setCoverPreview(null);
        }

        // 任务二：重构编辑模式下的数据回填逻辑 (Array to String)
        const normalized = normalizeIngredients(editingRecipe.ingredients);
        const ingListText = normalized
          .map((ing) => (ing.amount ? `${ing.name} ${ing.amount}` : ing.name))
          .join('\n');
        setIngredientsText(ingListText);

        if (Array.isArray(editingRecipe.steps) && editingRecipe.steps.length > 0) {
          setSteps(
            editingRecipe.steps.map((st, i) => {
              const isObj = typeof st === 'object' && st !== null;
              return {
                id: `step_edit_${i}_${Date.now()}`,
                content: typeof st === 'string' ? st : st.content || '',
                image: isObj ? (st as any).image : undefined,
                image_index: isObj ? (st as any).image_index : undefined,
              };
            })
          );
        }
      } else {
        setName('');
        setIngredientsText('');
        setThumbnail('');
        setCoverFile(null);
        setCoverPreview(null);
        setIsFavorite(false);
        setAiJsonInput('');
        setSteps([{ id: 'step_1', content: '' }]);
      }
    }
  }, [editingRecipe]);

  // 图像裁剪引擎 State
  const [cropperRawSrc, setCropperRawSrc] = useState<string | null>(null);
  const [cropperTarget, setCropperTarget] = useState<'cover' | number>('cover');

  // 必须所有 Hooks 执行完后再进行条件渲染 Early Return (恪守 React Rules of Hooks)
  if (!isAddModalOpen) return null;

  const adultCats = ['荤菜', '素菜', '凉菜', '汤羹', '主食'];
  const babyCats = ['饭面主食', '营养汤粥', '宝宝小菜', '饼类面点'];
  const currentCategories = targetGroup === 'adult' ? adultCats : babyCats;

  const handleAddStep = () => {
    setSteps((prev) => [
      ...prev,
      { id: `step_${Date.now()}_${prev.length + 1}`, content: '' },
    ]);
  };

  const handleRemoveStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStepContentChange = (index: number, val: string) => {
    setSteps((prev) => {
      const next = [...prev];
      next[index].content = val;
      return next;
    });
  };

  const handleStepImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const rawUrl = event.target?.result as string;
      setCropperRawSrc(rawUrl);
      setCropperTarget(index);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCoverFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const rawUrl = event.target?.result as string;
      setCropperRawSrc(rawUrl);
      setCropperTarget('cover');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropperComplete = async (result: { file: File; base64: string }) => {
    try {
      // 强制 1200px 宽高限制与 WebP 0.75 质量防爆压缩，体积直降 300KB 以内
      const compressed = await compressImage(result.base64 || result.file);
      if (cropperTarget === 'cover') {
        if (compressed.file) setCoverFile(compressed.file);
        setCoverPreview(compressed.base64);
      } else if (typeof cropperTarget === 'number') {
        const idx = cropperTarget;
        setSteps((prev) => {
          const next = [...prev];
          next[idx].image = compressed.base64;
          return next;
        });
      }
    } catch (err) {
      console.warn('图片防爆压缩回退降级:', err);
      if (cropperTarget === 'cover') {
        setCoverFile(result.file);
        setCoverPreview(result.base64);
      } else if (typeof cropperTarget === 'number') {
        const idx = cropperTarget;
        setSteps((prev) => {
          const next = [...prev];
          next[idx].image = result.base64;
          return next;
        });
      }
    }
    setCropperRawSrc(null);
  };

  const handleRemoveStepImage = (index: number) => {
    setSteps((prev) => {
      const next = [...prev];
      delete next[index].image;
      delete next[index].image_index;
      return next;
    });
  };

  const resetForm = () => {
    prevEditingIdRef.current = null;
    setName('');
    setIngredientsText('');
    setThumbnail('');
    setTagInput('');
    setCoverFile(null);
    setCoverPreview(null);
    setIsFavorite(false);
    setAiJsonInput('');
    setSteps([{ id: 'step_1', content: '' }]);
  };

  const handleCancelClick = () => {
    const hasData =
      name.trim() !== '' ||
      ingredientsText.trim() !== '' ||
      tagInput.trim() !== '' ||
      steps.some((s) => s.content.trim() !== '');

    if (hasData) {
      setShowCancelConfirm(true);
    } else {
      resetForm();
      closeAddModal();
    }
  };

  const confirmCancel = () => {
    setShowCancelConfirm(false);
    resetForm();
    closeAddModal();
  };

  // AI 智能解析并自动覆盖填充表单
  const handleParseAiJson = () => {
    if (!aiJsonInput.trim()) {
      alert('请先粘贴 AI 生成的 JSON 代码！');
      return;
    }

    try {
      const parsed = JSON.parse(aiJsonInput.trim());

      if (parsed.name) handleNameChange(parsed.name);
      if (parsed.target_user === 'adult' || parsed.target_user === 'baby') {
        setTargetGroup(parsed.target_user);
      }
      if (parsed.category) setCategory(parsed.category);
      if (parsed.thumbnail) setThumbnail(parsed.thumbnail);
      if (parsed.tag) setTagInput(parsed.tag);
      if (parsed.is_favorite || parsed.tag) setIsFavorite(true);

      if (typeof parsed.ingredients === 'string') {
        setIngredientsText(parsed.ingredients);
      } else if (Array.isArray(parsed.ingredients)) {
        setIngredientsText(
          parsed.ingredients
            .map((ing: { name?: string; amount?: string }) => `${ing.name || ''} ${ing.amount || ''}`)
            .join('\n')
        );
      }

      if (Array.isArray(parsed.steps) && parsed.steps.length > 0) {
        setSteps(
          parsed.steps.map((st: { content?: string; image?: string } | string, i: number) => ({
            id: `step_ai_${i}_${Date.now()}`,
            content: typeof st === 'string' ? st : st.content || '',
            image: typeof st === 'object' ? st.image : undefined,
          }))
        );
      }

      setIsAiPanelOpen(false);
      setToastMsg('🎉 智能解析并自动填充成功！');
      setTimeout(() => setToastMsg(null), 2200);
    } catch (err: any) {
      console.error('JSON 解析失败:', err);
      alert(`JSON 格式有误: ${err?.message || '请检查格式'}`);
    }
  };

  // 提交保存与 PocketBase 持久化 API
  const handleSave = async () => {
    try {
      const formattedSteps = steps
        .filter((s) => s.content.trim() !== '' || Boolean(s.image) || s.image_index !== undefined)
        .map((s) => ({
          content: s.content.trim(),
          image: s.image,
          image_index: s.image_index,
        }));

      const finalSteps = formattedSteps.length > 0 ? formattedSteps : ['默认烹饪步骤'];
      
      const textOnlySteps = finalSteps.map((s) => (typeof s === 'string' ? s : s.content || ''));
      if (JSON.stringify(textOnlySteps).length > 200000) {
        alert('步骤文本数据体积过大 (超出 20 万字符限制)，请检查是否有异常粘贴的超大文本！');
        return;
      }

      const newRecipeRecord: RecipeRecord = {
        id: `pb_rec_${Date.now()}`,
        name: name.trim() || '新美味菜谱',
        target_user: targetGroup,
        category: category,
        thumbnail: thumbnail.trim() || (targetGroup === 'adult' ? '🍳' : '🥣'),
        tag: normalizedTag || (isFavorite ? '爱吃常做,家常美味' : undefined),
        is_favorite: isFavorite,
        ingredients: correctIngredientsText(ingredientsText.trim()) || '食材 适量',
        steps: finalSteps,
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      };

      if (editingRecipe) {
        console.log('更新菜谱 (发送至 PocketBase / Store):', editingRecipe.id, newRecipeRecord, coverFile);
        await updateRecipe(editingRecipe.id, newRecipeRecord, coverFile);
        setToastMsg('🎉 菜谱已成功更新！');
      } else {
        console.log('保存新菜谱 (发送至 PocketBase / Store):', newRecipeRecord, coverFile);
        await addRecipe(newRecipeRecord, coverFile);
        setToastMsg('🎉 菜谱已成功添加！');
      }

      setTimeout(() => {
        setToastMsg(null);
        resetForm();
        closeAddModal();
      }, 900);
    } catch (err: any) {
      const origErr = err?.originalError || err?.data || err;
      alert("保存失败！报错信息：" + (err?.message || err) + "\n详情：" + JSON.stringify(origErr));
      console.error("PB Error:", err);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: '100%' }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 300 }}
        className="fixed inset-0 z-[80] bg-[#F7F8FA] flex flex-col overflow-y-auto font-sans select-none"
      >
        {/* Sticky 顶部 Header */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md z-10 flex items-center justify-between px-4 pb-3.5 pt-[calc(env(safe-area-inset-top,0px)+1rem)] border-b border-gray-100 shadow-2xs">
          <motion.button
            whileTap={{ scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            onClick={handleCancelClick}
            className="text-gray-500 font-bold text-base hover:text-gray-800 cursor-pointer"
          >
            取消
          </motion.button>
          <h2 className="text-lg font-black text-gray-900">{editingRecipe ? '编辑菜谱' : '添加新菜'}</h2>
          <motion.button
            whileTap={{ scale: isTagValid ? 0.92 : 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            onClick={handleSave}
            disabled={!isTagValid}
            className="bg-[#FFC300] text-gray-900 font-extrabold text-sm px-6 py-2 rounded-full shadow-xs hover:brightness-105 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 transition-all"
          >
            保存
          </motion.button>
        </div>

        {/* 智能填充 Success Toast */}
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

        {/* 防误触取消确认 Modal */}
        {showCancelConfirm && (
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-5 w-full max-w-xs shadow-2xl border border-gray-100 text-center">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
              <h4 className="text-base font-black text-gray-900 mb-1">未保存的内容将丢失</h4>
              <p className="text-xs text-gray-500 mb-4">确定放弃当前编辑的菜谱信息吗？</p>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 py-2 bg-gray-100 text-gray-700 font-bold text-xs rounded-xl hover:bg-gray-200"
                >
                  继续编辑
                </button>
                <button
                  onClick={confirmCancel}
                  className="flex-1 py-2 bg-red-500 text-white font-bold text-xs rounded-xl hover:bg-red-600 shadow-xs"
                >
                  放弃退出
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 表单内容主区域：统一圆角 rounded-2xl 与留白 p-4 space-y-4 */}
        <div className="p-4 space-y-4 pb-[calc(7rem+env(safe-area-inset-bottom))] max-w-md mx-auto w-full">
          {/* ✨ AI 智能极速录入 可折叠面板 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsAiPanelOpen(!isAiPanelOpen)}
              className="w-full px-4 py-3 bg-gradient-to-r from-amber-50/80 to-amber-100/30 flex justify-between items-center cursor-pointer border-b border-amber-100/50"
            >
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-[#F5A623]" />
                <span className="font-extrabold text-sm text-gray-900">AI 智能极速录入</span>
              </div>
              <span className="text-xs font-bold text-gray-400">
                {isAiPanelOpen ? '收起 ▲' : '展开粘贴 JSON ▼'}
              </span>
            </button>

            <AnimatePresence>
              {isAiPanelOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="p-4 space-y-3 bg-gray-50/50"
                >
                  <textarea
                    value={aiJsonInput}
                    onChange={(e) => setAiJsonInput(e.target.value)}
                    placeholder='请粘贴 AI 生成的标准 JSON 代码，例如：&#10;{ "name": "番茄炒蛋", "target_user": "adult", "category": "荤菜", "ingredients": "番茄 2个\n鸡蛋 4个", "steps": [{"id":1,"content":"切块打散翻炒"}] }'
                    className="w-full bg-white rounded-xl p-3 border border-gray-200 text-base font-mono text-gray-900 outline-none focus:ring-2 focus:ring-[#FFC300]/50 h-28 resize-none shadow-2xs transition-all"
                  />
                  <button
                    type="button"
                    onClick={handleParseAiJson}
                    className="w-full py-2 bg-[#FFC300] hover:bg-amber-400 text-gray-900 font-black text-xs rounded-xl shadow-xs active:scale-95 transition-all flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <span>解析并自动填充</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 菜名、标签与封面卡片 (视觉降噪与软磨砂微呼吸感) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
            <div>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="请输入菜名（如：香菇蒸肉饼）"
                className="text-lg font-extrabold text-gray-900 placeholder-gray-300 outline-none border-none bg-transparent w-full py-1 focus:ring-0"
              />
            </div>

            {/* Tag 标签输入区 (任意格式自由录入) */}
            <div className="pt-1 border-t border-gray-100/80">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-extrabold text-gray-400 shrink-0">标签:</span>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => handleTagInputChange(e.target.value)}
                  placeholder="自定义标签（例: 经典家常, 快捷简单）"
                  className="w-full text-xs font-bold px-3 py-1.5 rounded-xl border border-gray-200/80 bg-gray-50/60 text-gray-800 focus:bg-white focus:ring-2 focus:ring-[#FFC300]/60 outline-none transition-all"
                />
              </div>
            </div>

            {/* 封面图选择展示区 */}
            <div className="pt-1">
              {coverPreview ? (
                <div className="relative rounded-xl overflow-hidden w-20 h-20 border border-gray-200 group shadow-2xs">
                  <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setCoverFile(null);
                      setCoverPreview(null);
                    }}
                    className="absolute top-1 right-1 bg-gray-900/80 text-white rounded-full p-1 hover:bg-red-500 cursor-pointer"
                    title="移除封面"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center gap-2 bg-gray-50 text-gray-500 rounded-xl px-3 py-1.5 w-fit cursor-pointer hover:bg-gray-100 transition-colors border border-gray-100">
                  <Camera className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="text-xs font-bold text-gray-600">
                    {thumbnail ? `已设定图标: ${thumbnail}` : '添加封面图 (选填)'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverFileSelect}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          {/* 分类与受众极简操作条 (合并缩减为单行紧凑操作条，去冗余标题) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3.5 space-y-2.5">
            {/* 受众选择 Tab (大人吃/等等吃) 与 心动按钮单行通栏 */}
            <div className="flex justify-between items-center space-x-2">
              <div className="flex bg-gray-100/90 p-0.5 rounded-xl text-xs font-bold shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setTargetGroup('adult');
                    setCategory('荤菜');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    targetGroup === 'adult'
                      ? 'bg-[#FFC300] text-gray-900 font-extrabold shadow-2xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  👨‍👩‍👦 大人吃
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTargetGroup('baby');
                    setCategory('饭面主食');
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                    targetGroup === 'baby'
                      ? 'bg-[#FFC300] text-gray-900 font-extrabold shadow-2xs'
                      : 'text-gray-500 hover:text-gray-800'
                  }`}
                >
                  👶 等等吃
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsFavorite(!isFavorite)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center space-x-1 transition-all cursor-pointer ${
                  isFavorite
                    ? 'bg-red-50 text-red-500 border border-red-200 shadow-2xs'
                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100 border border-gray-100'
                }`}
              >
                <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'text-red-500 fill-red-500 animate-pulse' : 'text-gray-400'}`} />
                <span>{isFavorite ? '已心动' : '标记心动'}</span>
              </button>
            </div>

            {/* 紧凑分类药丸 Pills */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {currentCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    category === cat
                      ? 'bg-gray-900 text-[#FFC300] font-black shadow-2xs'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-100'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 食材与步骤卡片 (格式塔纯白子卡片架构) */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
            {/* 食材输入区 */}
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-2">需要买啥菜？</h3>
              <textarea
                value={ingredientsText}
                onChange={(e) => setIngredientsText(e.target.value)}
                placeholder={'请输入食材，一行一个。例如：\n牛肉 500g\n鸡蛋 2个'}
                className="w-full bg-gray-50/80 rounded-xl p-3 border border-gray-200/60 text-base text-gray-900 font-bold outline-none focus:bg-white focus:ring-2 focus:ring-[#FFC300]/50 h-24 resize-none shadow-2xs"
              />
            </div>

            {/* 烹饪步骤嵌套子卡片 */}
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-2.5">怎么做？</h3>
              
              <div className="bg-gray-50/90 rounded-2xl p-3 border border-gray-200/60 space-y-3 mb-3">
                {steps.map((step, idx) => (
                  /* 每一个步骤被独立包裹在纯白卡片中，形成极强的视觉绑定 */
                  <div key={step.id || `step_${idx}`} className="bg-white rounded-xl p-3.5 shadow-2xs border border-gray-100 space-y-2.5 relative">
                    <div className="flex justify-between items-center">
                      <span className="bg-[#FFC300] text-gray-900 text-[11px] font-black px-2.5 py-0.5 rounded-md">
                        步骤 {idx + 1}
                      </span>
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(idx)}
                          className="text-gray-400 hover:text-red-500 w-5 h-5 rounded-full flex items-center justify-center cursor-pointer"
                          title="删除该步骤"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <textarea
                      value={step.content}
                      onChange={(e) => handleStepContentChange(idx, e.target.value)}
                      placeholder={`请输入步骤 ${idx + 1} 的详细操作...`}
                      className="w-full bg-gray-50/70 focus:bg-white text-base font-bold text-gray-900 rounded-lg p-2.5 border border-gray-200/50 outline-none focus:ring-2 focus:ring-[#FFC300]/50 h-18 resize-none transition-colors"
                    />

                    {/* 步骤图片操作区 (去重 Emoji) */}
                    <div className="pt-0.5">
                      {(() => {
                        const stepImgSrc = step.image || getStepImageUrl(editingRecipe, step);
                        return stepImgSrc ? (
                          <div className="relative rounded-lg overflow-hidden w-20 h-14 border border-gray-200 group">
                            <img src={stepImgSrc} alt={`Step ${idx + 1}`} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => handleRemoveStepImage(idx)}
                              className="absolute top-1 right-1 bg-gray-900/80 text-white rounded-full p-0.5 hover:bg-red-500 cursor-pointer"
                              title="删除图片"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex items-center gap-1.5 text-xs text-[#F5A623] font-bold cursor-pointer hover:opacity-80 transition-opacity w-fit">
                            <ImagePlus className="w-3.5 h-3.5 text-[#F5A623]" />
                            <span>添加步骤图 (选填)</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleStepImageUpload(idx, e)}
                            />
                          </label>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddStep}
                className="w-full py-2.5 bg-gray-50 hover:bg-amber-50/60 text-gray-700 font-extrabold text-xs rounded-xl flex items-center justify-center space-x-1 border border-gray-200/60 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4 text-gray-600" />
                <span>添加下一步骤</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* 图像裁剪引擎全屏 Modal */}
      {cropperRawSrc && (
        <ImageCropperModal
          imageSrc={cropperRawSrc}
          aspect={4 / 3}
          onCancel={() => setCropperRawSrc(null)}
          onCropComplete={handleCropperComplete}
        />
      )}
    </AnimatePresence>
  );
};
