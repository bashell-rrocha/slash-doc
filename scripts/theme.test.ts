import { describe, expect, mock, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(import.meta.dir, "..");
const TEMAS = join(RAIZ, "node_modules/starlight-theme-catppuccin/themes");

describe("tema do slash-doc", () => {
  test("astro.config.mjs passa ao plugin as opções dark e light da v2, com mocha e latte em mauve", async () => {
    // Arrange
    const chamadas: unknown[] = [];
    mock.module("starlight-theme-catppuccin", () => ({
      default: (opcoes: unknown) => {
        chamadas.push(opcoes);
        return { name: "starlight-theme-catppuccin", hooks: {} };
      },
    }));

    // Act
    await import("../astro.config.mjs");

    // Assert
    expect(chamadas).toEqual([{ dark: "mocha-mauve", light: "latte-mauve" }]);
  });

  test("os temas escolhidos existem nos arquivos do pacote instalado", () => {
    // Arrange
    const temas = ["catppuccin-mocha-mauve.css", "catppuccin-latte-mauve.css"];

    // Act
    const existem = temas.map((tema) => existsSync(join(TEMAS, tema)));

    // Assert
    expect(existem).toEqual([true, true]);
  });
});
