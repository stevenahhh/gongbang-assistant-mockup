import { render } from "preact";
import { App } from "./app";
import { preloadAllWhenIdle } from "./router";

addEventListener("touchstart", () => {}, { passive: true });

render(<App />, document.getElementById("app")!);
requestAnimationFrame(() => preloadAllWhenIdle());

if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
  addEventListener("load", () => void navigator.serviceWorker.register("/sw.js"));
}
