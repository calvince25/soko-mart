import { describe, expect, it } from "vitest";
import { stripViteClientScript } from "./vite";

describe("stripViteClientScript", () => {
  it("removes the injected Vite client script from integrated preview HTML", () => {
    const html = `<!doctype html><head>
      <script type="module" src="/@vite/client"></script>
      <script type="module" src="/src/main.tsx"></script>
    </head>`;

    const result = stripViteClientScript(html);

    expect(result).not.toContain("/@vite/client");
    expect(result).toContain('src="/src/main.tsx"');
  });

  it("leaves unrelated scripts unchanged", () => {
    const html = '<script type="module" src="/src/main.tsx"></script>';

    expect(stripViteClientScript(html)).toBe(html);
  });
});
