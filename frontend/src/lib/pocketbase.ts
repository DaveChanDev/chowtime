import PocketBase from 'pocketbase';

// 默认局域网 PocketBase 服务地址，优先支持 VITE_PB_URL 环境变量覆盖
export const POCKETBASE_URL =
  import.meta.env.VITE_PB_URL ||
  import.meta.env.VITE_POCKETBASE_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:8090');

export const pb = new PocketBase(POCKETBASE_URL);

// 自动取消未完成的历史长轮询请求
pb.autoCancellation(false);
