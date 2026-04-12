import sarmalLight from "../themes/sarmal-editorial.json";
import sarmalDark from "../themes/sarmal-editorial-dark.json";

export const themes = {
  light: sarmalLight as unknown as { name: string },
  dark: sarmalDark as unknown as { name: string },
};

export const codeThemes = themes as {
  light: { name: string };
  dark: { name: string };
};

export const shikiConfig = {
  themes,
  wrap: true,
};
