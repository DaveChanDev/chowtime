import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ZoomIn, Crop } from 'lucide-react';
import { getCroppedImg, type PixelCrop } from '../utils/cropImage';

interface ImageCropperModalProps {
  imageSrc: string | null;
  aspect?: number;
  onCancel: () => void;
  onCropComplete: (result: { file: File; base64: string }) => void;
}

export const ImageCropperModal: React.FC<ImageCropperModalProps> = ({
  imageSrc,
  aspect = 4 / 3, // 默认 4:3 横向标准比例
  onCancel,
  onCropComplete,
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<PixelCrop | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCropChange = useCallback((newCrop: { x: number; y: number }) => {
    setCrop(newCrop);
  }, []);

  const handleZoomChange = useCallback((newZoom: number) => {
    setZoom(newZoom);
  }, []);

  const handleCropCompleteInternal = useCallback(
    (_croppedArea: any, croppedAreaPixels: PixelCrop) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const handleConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    try {
      setIsProcessing(true);
      const croppedResult = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropComplete(croppedResult);
    } catch (err) {
      console.error('图片裁剪失败:', err);
      alert('图片裁剪失败，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!imageSrc) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-gray-950 flex flex-col justify-between font-sans select-none"
      >
        {/* 顶部 Header */}
        <div className="flex items-center justify-between p-4 bg-gray-900/80 backdrop-blur-md z-10 border-b border-gray-800">
          <button
            onClick={onCancel}
            className="text-gray-400 font-bold text-sm hover:text-white transition-colors cursor-pointer flex items-center space-x-1"
          >
            <X className="w-4 h-4" />
            <span>取消</span>
          </button>
          
          <div className="flex items-center space-x-1.5 text-white font-extrabold text-sm">
            <Crop className="w-4 h-4 text-[#FFC300]" />
            <span>调整构图 (4:3)</span>
          </div>

          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="bg-[#FFC300] text-gray-900 font-black text-xs px-4 py-2 rounded-full shadow-md hover:brightness-105 active:scale-95 transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{isProcessing ? '处理中...' : '确认裁剪'}</span>
          </button>
        </div>

        {/* 主裁剪画布区 (手势拖拽 / 缩放) */}
        <div className="relative flex-1 bg-black w-full overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={handleCropChange}
            onCropComplete={handleCropCompleteInternal}
            onZoomChange={handleZoomChange}
            showGrid={true}
          />
        </div>

        {/* 底部拖拽缩放控制条 */}
        <div className="p-5 bg-gray-900/90 backdrop-blur-md border-t border-gray-800 flex items-center space-x-4">
          <ZoomIn className="w-5 h-5 text-gray-400 shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[#FFC300]"
          />
          <span className="text-xs font-mono font-bold text-amber-400 shrink-0 min-w-[36px] text-right">
            {zoom.toFixed(1)}x
          </span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
