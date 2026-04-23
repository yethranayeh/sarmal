/**
 *  wraps each heading and its following siblings into a <section>
 *  This gives every sticky heading its own containing block, so it unsticks when
 *    that section scrolls out of view instead of piling up at the same top offset.
 */
const rehypeWrapSections = () => (tree) => {
  const children = tree.children;
  const result = [];
  let section = null;

  for (const node of children) {
    const isHeading = node.type === "element" && /^h[1-6]$/.test(node.tagName);
    if (isHeading) {
      section = {
        type: "element",
        tagName: "section",
        properties: {},
        children: [node],
      };
      result.push(section);
    } else if (section) {
      section.children.push(node);
    } else {
      result.push(node);
    }
  }

  tree.children = result;
};

export default rehypeWrapSections;
