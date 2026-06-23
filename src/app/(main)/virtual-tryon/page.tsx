import { Metadata } from "next";
import VirtualTryOnClient from "./VirtualTryOnClient";

export const metadata: Metadata = {
  title: "Virtual Try-On | Mumbai GlamHub",
  description: "Try hairstyles, facial treatments, and makeup virtually with AI-powered AR technology",
};

export default function VirtualTryOnPage() {
  return <VirtualTryOnClient />;
}
