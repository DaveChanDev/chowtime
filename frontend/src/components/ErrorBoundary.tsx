import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught Error Boundary Catch:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6 text-center select-none">
          <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-4 border border-red-500/30">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-white mb-2">遇到非预期的运行状态</h2>
          <p className="text-xs text-gray-400 max-w-sm mb-6 leading-relaxed">
            {this.state.error?.message || '前端渲染遇到类型安全异常，已自动防护拦截'}
          </p>
          <button
            onClick={this.handleReset}
            className="px-6 py-3 bg-[#FFC300] text-gray-900 font-black text-sm rounded-full shadow-lg hover:brightness-105 active:scale-95 transition-all flex items-center space-x-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>刷新页面重试</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
