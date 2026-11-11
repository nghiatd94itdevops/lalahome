import { Component } from "react";

// Shows a recoverable message instead of a blank page when a screen throws while rendering.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`LalaFlow screen crashed: ${error.message}`, info.componentStack);
  }

  componentDidUpdate(previous) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash-note" role="alert">
        <h2>Trang gặp lỗi khi hiển thị</h2>
        <p>{this.state.error.message}</p>
        <div className="crash-actions">
          <button type="button" onClick={() => window.location.reload()}>Tải lại trang</button>
          <button type="button" onClick={() => this.setState({ error: null })}>Thử lại</button>
        </div>
      </div>
    );
  }
}
