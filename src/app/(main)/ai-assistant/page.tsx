import { Metadata } from "next";
import AIAssistantClient from "./AIAssistantClient";

export const metadata: Metadata = {
  title: "AI Beauty Assistant",
  description: "Ask our AI for personalized salon and beauty recommendations in Mumbai.",
};

export default function AIAssistantPage() {
  return <AIAssistantClient />;
}
