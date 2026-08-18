import { enterFade } from "app/lib/animations";
import { useState } from "react";
import { Resizable } from "react-resizable";
import "react-resizable/css/styles.css";

// Grips sit at the bottom of each vertical edge instead of react-resizable's
// default vertically-centered position.
function bottomHandle(axis, ref) {
  return (
    <span
      ref={ref}
      className={`absolute -top-5 text-neutral-600 z-10 cursor-ew-resize touch-none rounded-full transition-colors ${
        axis === "w" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2"
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
      >
        <path fill="currentColor" d="m9 6l-6 6l6 6zm6 12l6-6l-6-6z" />
      </svg>
    </span>
  );
}

// Bands match the ruler markers below.
function deviceType(width) {
  if (width >= 1024) return "Laptop";
  if (width >= 768) return "Tablet";
  if (width >= 425) return "Mobile L";
  if (width >= 375) return "Mobile M";
  return "Mobile S";
}

export function ResizablePreview({ children }) {
  const [width, setWidth] = useState(1024);

  return (
    <div className={`flex flex-col gap-2 w-full min-h-60 ${enterFade}`}>
      <div className="h-5 w-full mb-2 bg-neutral-200 inline-flex relative">
        <span className="absolute left-1/2 -translate-x-1/2 z-10 px-2 bg-neutral-200 text-[10px] leading-5 font-medium tabular-nums text-neutral-600 pointer-events-none whitespace-nowrap">
          {Math.round(width)}px · {deviceType(width)}
        </span>
        <div
          className="inline-flex mx-auto border-x-2 border-neutral-400"
          style={{ width: "1024px" }}
          onClick={(e) => {
            e.stopPropagation();
            setWidth(1024);
          }}
        >
          <div
            className="inline-flex mx-auto border-x-2 border-neutral-400"
            style={{ width: "768px" }}
            onClick={(e) => {
              e.stopPropagation();
              setWidth(768);
            }}
          >
            <div
              className="inline-flex mx-auto border-x-2 border-neutral-400"
              style={{ width: "425px" }}
              onClick={(e) => {
                e.stopPropagation();
                setWidth(425);
              }}
            >
              <div
                className="inline-flex mx-auto border-x-2 border-neutral-400"
                style={{ width: "375px" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setWidth(375);
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>
      <Resizable
        width={width}
        height={0}
        onResize={(_, { size }) => setWidth(size.width)}
        minConstraints={[320, 0]}
        maxConstraints={[1280, 0]}
        resizeHandles={["e", "w"]}
        handle={bottomHandle}
        axis="x"
      >
        <div
          className="box relative mx-auto border-x border-neutral-300"
          style={{ width: width + "px" }}
        >
          {children}
        </div>
      </Resizable>
    </div>
  );
}
