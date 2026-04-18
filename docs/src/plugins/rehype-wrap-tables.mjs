/** Rehype plugin: wraps every <table> in <div class="table-scroll"> */
const rehypeWrapTables = () => (tree) => {
  wrapTables(tree);
};

function wrapTables(node) {
  if (!node?.children) {
    return;
  }

  node.children = node.children.map((child) => {
    if (!child || child.type !== "element") {
      return child;
    }

    if (child.tagName === "table") {
      return {
        type: "element",
        tagName: "div",
        properties: { className: ["table-scroll"] },
        children: [child],
      };
    }
    wrapTables(child);
    return child;
  });
}

export default rehypeWrapTables;
