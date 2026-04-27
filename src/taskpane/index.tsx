import * as React from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@fluentui/react";
import { App } from "./components/App";

/* global document, Office, module, require, HTMLElement */

const rootElement: HTMLElement | null = document.getElementById("container");
const root = rootElement ? createRoot(rootElement) : undefined;

/* Render application after Office initializes */
Office.onReady(() => {
  root?.render(
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
});

if ((module as any).hot) {
  (module as any).hot.accept("./components/App", () => {
    const NextApp = require("./components/App").App;
    root?.render(
      <ThemeProvider>
        <NextApp />
      </ThemeProvider>
    );
  });
}
