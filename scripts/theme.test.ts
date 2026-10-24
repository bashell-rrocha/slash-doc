import { beforeAll, describe, expect, mock, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(import.meta.dir, "..");
const TEMAS = join(RAIZ, "node_modules/starlight-theme-catppuccin/themes");

interface OpcoesDoTema {
  readonly dark: string;
  readonly light: string;
}

describe("tema do slash-doc", () => {
  const chamadas: OpcoesDoTema[] = [];

  // The config is imported once: both tests read the options it really passes to the plugin.
  beforeAll(async () => {
    mock.module("starlight-theme-catppuccin", () => ({
      default: (opcoes: OpcoesDoTema) => {
        chamadas.push(opcoes);
        return { name: "starlight-theme-catppuccin", hooks: {} };
      },
    }));
    await import("../astro.config.mjs");
  });

  test("astro.config.mjs passa ao plugin as opções dark e light da v2, com mocha e latte em mauve", () => {
    // Arrange
    const esperado = [{ dark: "mocha-mauve", light: "latte-mauve" }];

    // Act
    const recebido = chamadas;

    // Assert
    expect(recebido).toEqual(esperado);
  });

  test("os temas passados ao plugin existem nos arquivos do pacote instalado", () => {
    // Arrange
    const temas = chamadas.flatMap(({ dark, light }) => [dark, light]);

    // Act
    const existem = temas.map((tema) => existsSync(join(TEMAS, `catppuccin-${tema}.css`)));

    // Assert
    expect(temas.length).toBeGreaterThan(0);
    expect(existem.every(Boolean)).toBe(true);
  });
});
