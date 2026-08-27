import "./app/globals.css";
import { createRoot } from "react-dom/client";
import PuzzleRPGGraphicsV2 from "./app/PuzzleRPGGraphicsV2";
import ServiceWorkerRegistration from "./app/ServiceWorkerRegistration";

const mount = document.getElementById("root");
if (!mount) throw new Error("Puzzle RPG mount element is missing");

createRoot(mount).render(
  <>
    <ServiceWorkerRegistration />
    <PuzzleRPGGraphicsV2 />
  </>,
);
