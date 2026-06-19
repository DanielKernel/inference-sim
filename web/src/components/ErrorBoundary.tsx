import React from "react";

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("UI render failure captured by ErrorBoundary:", error, errorInfo);
  }

  public render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div className="fatal-error-shell">
          <div className="fatal-error-card">
            <div className="eyebrow">界面渲染异常</div>
            <h2>页面发生错误，但服务仍在运行</h2>
            <p>
              这通常意味着前端遇到了未处理的渲染错误，或收到了异常数据格式。你可以先刷新页面；
              如果问题持续存在，请把下方错误信息反馈出来。
            </p>
            <pre>{this.state.error.message}</pre>
            <button className="primary-btn" type="button" onClick={() => window.location.reload()}>
              刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
