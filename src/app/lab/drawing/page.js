import { notFound } from "next/navigation";
import DrawingStages from "./drawing-stages";

export const metadata = { title: "Drawing lab", robots: { index: false } };

// Development tool: the easel drawing at three stages.
export default function DrawingLab() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DrawingStages />;
}
