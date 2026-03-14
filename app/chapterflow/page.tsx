import { redirect } from "next/navigation";
import { buildChapterFlowAppHref } from "@/app/_lib/chapterflow-brand";

export default function ChapterFlowRedirectPage() {
  redirect(buildChapterFlowAppHref("/"));
}
