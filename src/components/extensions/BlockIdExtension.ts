import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";
import type { Node } from "@tiptap/pm/model";

/**
 * @GOV
 * codes: BR-ED-DATA-002
 * type: DATA
 * chain: ED-OPEN-FILE
 * rules: BR-ED-DATA-002
 * boundary: in=ProseMirror appendTransaction with new block nodes | out=BlockId UUID attribute stamped on paragraph, heading, blockquote, codeBlock, listItem, tableCell nodes via crypto.randomUUID per session; never persists BlockId to disk
 * term_ref: TERM-ED-004
 */

const BLOCK_NODE_NAMES = [
  "paragraph",
  "heading",
  "blockquote",
  "codeBlock",
  "listItem",
  "tableCell",
] as const;

export const blockIdPluginKey = new PluginKey("blockId");

function stampMissingBlockIds(tr: Transaction): Transaction {
  let modified = false;
  tr.doc.descendants((node: Node, pos: number) => {
    if (!BLOCK_NODE_NAMES.includes(node.type.name as (typeof BLOCK_NODE_NAMES)[number])) return;
    if (node.attrs["data-block-id"]) return;
    const id = crypto.randomUUID();
    tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, "data-block-id": id });
    modified = true;
  });
  return modified ? tr.setMeta(blockIdPluginKey, { internal: true }) : tr;
}

export const BlockIdExtension = Extension.create({
  name: "blockId",

  addGlobalAttributes() {
    return [
      {
        types: [...BLOCK_NODE_NAMES],
        attributes: {
          "data-block-id": {
            default: null,
            parseHTML: (el: Element) => el.getAttribute("data-block-id"),
            renderHTML: (attrs: Record<string, unknown>) =>
              attrs["data-block-id"] ? { "data-block-id": attrs["data-block-id"] } : {},
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: blockIdPluginKey,
        appendTransaction(_transactions, _oldState, newState) {
          const tr = newState.tr;
          return stampMissingBlockIds(tr);
        },
      }),
    ];
  },
});
