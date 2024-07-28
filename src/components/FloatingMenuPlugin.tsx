import { useCallback, useEffect, useRef, useState } from "react";
import { offset, shift } from "@floating-ui/dom";

import { createPortal } from "react-dom";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_NORMAL as NORMAL_PRIORITY,
  SELECTION_CHANGE_COMMAND as ON_SELECTION_CHANGE,
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { computePosition } from "@floating-ui/dom";

import { usePointerInteractions } from "./usePointerinteractions";

const DEFAULT_DOM_ELEMENT = document.body;

type FloatingMenuCoords = { x: number; y: number } | undefined;

export type FloatingMenuComponentProps = {
  editor: ReturnType<typeof useLexicalComposerContext>[0];
  hide: () => void;
};

export type FloatingMenuPluginProps = {
  element?: HTMLElement;
  MenuComponent?: React.FC<FloatingMenuComponentProps>;
};

export function FloatingMenuPlugin({
  element,
  MenuComponent,
}: FloatingMenuPluginProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<FloatingMenuCoords>(undefined);
  const show = coords !== undefined;

  const [editor] = useLexicalComposerContext();
  const { isPointerDown, isPointerReleased } = usePointerInteractions();

  const calculatePosition = useCallback(() => {
    const domSelection = getSelection();
    const domRange =
      domSelection?.rangeCount !== 0 && domSelection?.getRangeAt(0);

    if (!domRange || !ref.current || isPointerDown) return setCoords(undefined);

    computePosition(domRange, ref.current, {
      placement: "right",
      middleware: [offset(10), shift()],
    })
      .then((pos: { x: number; y: number }) => {
        setCoords({ x: pos.x, y: pos.y });
      })
      .catch(() => {
        setCoords(undefined);
      });
  }, [isPointerDown]);

  const $handleSelectionChange = useCallback(() => {
    if (editor.isComposing()) return false;

    if (editor.getRootElement() !== document.activeElement) {
      setCoords(undefined);
      return true;
    }

    const selection = $getSelection();

    if ($isRangeSelection(selection) && !selection.anchor.is(selection.focus)) {
      calculatePosition();
    } else {
      setCoords(undefined);
    }

    return true;
  }, [editor, calculatePosition]);

  useEffect(() => {
    const unregisterCommand = editor.registerCommand(
      ON_SELECTION_CHANGE,
      $handleSelectionChange,
      NORMAL_PRIORITY
    );
    return unregisterCommand;
  }, [editor, $handleSelectionChange]);

  useEffect(() => {
    if (!show && isPointerReleased) {
      editor.getEditorState().read(() => {
        $handleSelectionChange();
      });
    }
    // Adding show to the dependency array causes an issue if
    // a range selection is dismissed by navigating via arrow keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPointerReleased, $handleSelectionChange, editor]);

  if (!MenuComponent) return null;

  return createPortal(
    <div
      ref={ref}
      aria-hidden={!show}
      style={{
        position: "fixed",
        bottom: "46px",
        left: "calc(50% - 70px)",
      }}
    >
      <MenuComponent
        editor={editor}
        hide={(): void => {
          setCoords(undefined);
        }}
      />
    </div>,
    element ?? DEFAULT_DOM_ELEMENT
  );
}
