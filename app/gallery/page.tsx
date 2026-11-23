import MemoryWall from "../MemoryWall";
import type { Metadata } from "next";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Our Memory Gallery — TwoFold",
  description:
    "A few favourite moments from Queen Moyosore and Peace Adekunle, kept with love.",
};
export default function GalleryPage() {
  return <MemoryWall mode="gallery" />;
}
