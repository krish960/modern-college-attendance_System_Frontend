/**
 * Catches an error that happens while a page is drawing, so one broken page does not blank the whole app.
 * The sidebar and top bar stay visible and the person can open another page or try again.
 * AppLayout gives it key={pathname}, so moving to another page resets it automatically.
 */
import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { failed: false };

  // React calls this when a child throws while rendering.
  static getDerivedStateFromError() {
    return { failed: true };
  }

  // The details go to the browser console for whoever maintains the system.
  componentDidCatch(error) {
    console.error("Page failed to draw:", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="panel" role="alert" style={{ padding: "1.4rem" }}>
        <h2>This page could not be shown</h2>
        <p className="muted">Something went wrong while opening this page. Your saved data is safe. Try again, or open another page from the menu.</p>
        <button type="button" className="btn" onClick={() => this.setState({ failed: false })}>Try again</button>
      </div>
    );
  }
}
