"use client";

import { blobToDataUri } from "@/utils/blob";
import * as fal from "@fal-ai/serverless-client";
import {
  Editor,
  TLArrowShape,
  TLDefaultShape,
  TLEventMapHandler,
  TLFrameShape,
  TLShape,
  Tldraw,
  debounce,
  getSvgAsImage,
  useEditor,
} from "@tldraw/tldraw";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

fal.config({
  requestMiddleware: fal.withProxy({
    targetUrl: "/api/fal/proxy",
  }),
});

const DEBOUNCE_TIME = 0.0; // lol
const URL = "wss://110602490-lcm-sd15-i2i.gateway.alpha.fal.ai/ws";

export default function Home() {
  const [editor, setEditor] = useState<Editor>();

  const onEditorMount = (editor: Editor) => {
    setEditor(editor);
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

  const webSocketRef = useRef<WebSocket | null>(null);
  const isReconnecting = useRef(false);

  const connect = useCallback(() => {
    webSocketRef.current = new WebSocket(URL);
    webSocketRef.current.onopen = () => {};
    webSocketRef.current.onclose = () => {};
    webSocketRef.current.onerror = (error) => {};

    webSocketRef.current.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data);
        if (data.images && data.images.length > 0) {
          console.log("got image", data.images[0].url);
          // UPDATE STUFF WITH data.image[0].url
        }
      } catch (e) {
        console.error("Error parsing the WebSocket response:", e);
      }
    };
  }, []);

  const sendMessage = useCallback(
    async (message: string) => {
      if (
        !isReconnecting.current &&
        webSocketRef.current?.readyState !== WebSocket.OPEN
      ) {
        isReconnecting.current = true;
        connect();
      }

      if (
        isReconnecting.current &&
        webSocketRef.current?.readyState !== WebSocket.OPEN
      ) {
        await new Promise<void>((resolve) => {
          const checkConnection = setInterval(() => {
            if (webSocketRef.current?.readyState === WebSocket.OPEN) {
              clearInterval(checkConnection);
              resolve();
            }
          }, 100);
        });
        isReconnecting.current = false;
      }
      webSocketRef.current?.send(message);
    },
    [connect]
  );

  const sendCurrentData = useMemo(() => {
    return debounce(sendMessage, DEBOUNCE_TIME);
  }, [sendMessage]);

  const updateFrame = useCallback(
    async (editor: Editor, frame: TLFrameShape) => {
      const arrowsPointingToFrame = editor
        .getCurrentPageShapes()
        .filter((shape) => {
          if (shape.type !== "arrow") return false;
          const arrow = shape as TLArrowShape;
          if (arrow.props.end.type !== "binding") return false;
          if (arrow.props.end.boundShapeId !== frame.id) return false;
          return true;
        }) as TLArrowShape[];

      const sourceArrow = arrowsPointingToFrame.find((arrow) => {
        if (arrow.props.start.type !== "binding") return false;
        const sourceShape = editor.getShape(arrow.props.start.boundShapeId);
        if (!sourceShape) return false;
        if (sourceShape.type !== "frame") return false;
        return true;
      });

      if (!sourceArrow) return;

      // @ts-expect-error: trust me fam
      const sourceFrame = editor.getShape(sourceArrow.props.start.boundShapeId);
      if (!sourceFrame) return;

      const svg = await editor.getSvg([sourceFrame.id], { background: true });
      if (!svg) return;

      const image = await getSvgAsImage(svg, editor.environment.isSafari, {
        type: "png",
        quality: 1,
        scale: 1,
      });
      if (!image) return;

      const prompt = sourceArrow.props.text;
      const imageDataUri = await blobToDataUri(image);

      const request = {
        image_url: imageDataUri,
        prompt,
        sync_mode: true,
        strength: 0.7,
        seed: 42, // TODO make this configurable in the UI
        enable_safety_checks: false,
        // num_inference_steps: 4,
      };

      sendCurrentData(JSON.stringify(request));
    },
    [sendCurrentData]
  );

  useEffect(() => {
    if (!editor) return;

    const handleTickEvent: TLEventMapHandler<"tick"> = (event) => {
      const frames = editor.getCurrentPageShapes().filter((shape) => {
        return shape.type === "frame";
      }) as TLFrameShape[];

      for (const frame of frames) {
        updateFrame(editor, frame);
      }
    };

    editor.on("tick", handleTickEvent);

    return () => {
      editor.off("tick", handleTickEvent);
    };
  }, [editor, updateFrame]);

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
