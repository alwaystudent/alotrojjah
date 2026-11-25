import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unexpected error occurred',
    };
  }

  componentDidCatch(error: Error) {
    console.error('Application ErrorBoundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F3EB] text-[#261C14] flex items-center justify-center p-4" dir="rtl">
          <div className="max-w-md w-full rounded-2xl bg-[#FFFDF9] border border-[#DDD2BE] p-6 shadow-md space-y-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#FBF3DF] border border-[#E5C983] flex items-center justify-center text-[#C88A14]">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-extrabold font-display-islamic text-[#2D2218]">
              حدث عارض تقني غير متوقع
            </h2>
            <p className="text-xs text-[#5C4B3B] leading-relaxed break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mustard-gradient-btn px-5 py-2.5 rounded-xl text-xs font-bold text-[#FFFDF9] inline-flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة تحميل التطبيق</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
