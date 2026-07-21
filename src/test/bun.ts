interface HProc { exitCode?: number; }

export {};

const processHost = (globalThis as unknown as { process: HProc }).process;
const { app } = await import("../main/server.js");

try {
  const page = await fetch(new URL("index.html", app.url));
  const html = await page.text();
  if (
    !page.ok ||
    !html.includes('src="./thistle.js"') ||
    html.includes("__thistle") ||
    html.includes("WebSocket")
  ) {
    throw new Error("static preview did not serve the server-free page");
  }

  const [bundle, xterm, fit, css, config, thx39] = await Promise.all([
    fetch(new URL("thistle.js", app.url)),
    fetch(new URL("vendor/xterm.js", app.url)),
    fetch(new URL("vendor/xterm-fit.js", app.url)),
    fetch(new URL("vendor/xterm.css", app.url)),
    fetch(new URL("mikuos.config.json", app.url)),
    fetch(new URL("assets/hello.39", app.url)),
  ]);
  const source = await bundle.text();
  const runtime = await config.json() as { os?: { prettyName?: string } };

  if (!bundle.ok || !source.includes("launchThistle")) {
    throw new Error("static preview did not serve thistle.js");
  }
  if (/\bWebSocket\b|__thistle\//.test(source)) {
    throw new Error("static bundle retained a runtime server dependency");
  }
  if (!xterm.ok || !(await xterm.text()).includes("Terminal")) {
    throw new Error("static preview did not serve xterm.js");
  }
  if (!fit.ok || !(await fit.text()).includes("FitAddon")) {
    throw new Error("static preview did not serve the xterm fit addon");
  }
  if (!css.ok || !(await css.text()).includes(".xterm")) {
    throw new Error("static preview did not serve xterm.css");
  }
  if (runtime.os?.prettyName !== "初音ミクOS v｡三") {
    throw new Error("static preview did not serve the OS configuration");
  }
  if (!thx39.ok || thx39.headers.get("content-type") !== "application/x-thistle-executable") {
    throw new Error("static preview did not package .39 as a THX executable");
  }

  console.log("ok - Bun serves bytes only for the static browser launch");
} catch (error) {
  processHost.exitCode = 1;
  console.error(error);
} finally {
  app.stop();
}
