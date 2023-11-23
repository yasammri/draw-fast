"use client";

import * as fal from "@fal-ai/serverless-client";
import { Editor, Tldraw, useEditor } from "@tldraw/tldraw";
import { useCallback } from "react";

fal.config({
  requestMiddleware: fal.withProxy({
    targetUrl: "/api/fal/proxy",
  }),
});

export default function Home() {
  const onEditorMount = (editor: Editor) => {
    const frame = editor
      .getCurrentPageShapes()
      .find((shape) => shape.type === "frame");

    if (frame) return;

    editor.createShape({
      type: "frame",
      x: 120,
      y: 180,
      props: {
        w: 512,
        h: 512,
        name: "a city skyline",
      },
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
      <div className="fixed inset-0">
        <Tldraw
          persistenceKey="draw-fast"
          onMount={onEditorMount}
          shareZone={<DrawFastButton />}
        />
      </div>
    </main>
  );
}

export function DrawFastButton() {
  const editor = useEditor();
  const makeLive = useCallback(() => {
    editor.setCurrentTool("frame");
  }, [editor]);

  return (
    <button
      onClick={makeLive}
      className="p-2"
      style={{ cursor: "pointer", zIndex: 100000, pointerEvents: "all" }}
    >
      <div className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
        Draw Fast
      </div>
    </button>
  );
}
