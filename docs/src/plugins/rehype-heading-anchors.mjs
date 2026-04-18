import rehypeAutolinkHeadings from "rehype-autolink-headings";

/** @see https://lucide.dev/icons/hash */
const makeLucideHashIcon = () => ({
  type: "element",
  tagName: "svg",
  properties: {
    xmlns: "http://www.w3.org/2000/svg",
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ariaHidden: "true",
  },
  children: [
    {
      type: "element",
      tagName: "line",
      properties: { x1: "4", x2: "20", y1: "9", y2: "9" },
      children: [],
    },
    {
      type: "element",
      tagName: "line",
      properties: { x1: "4", x2: "20", y1: "15", y2: "15" },
      children: [],
    },
    {
      type: "element",
      tagName: "line",
      properties: { x1: "10", x2: "8", y1: "3", y2: "21" },
      children: [],
    },
    {
      type: "element",
      tagName: "line",
      properties: { x1: "16", x2: "14", y1: "3", y2: "21" },
      children: [],
    },
  ],
});

/** @type {import('unified').Pluggable} */
export default [
  rehypeAutolinkHeadings,
  {
    behavior: "prepend",
    properties: { class: "anchor-link", ariaHidden: "true", tabIndex: -1 },
    content: [makeLucideHashIcon()],
  },
];
