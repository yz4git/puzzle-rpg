import PuzzleRPGEnhanced from "./PuzzleRPGEnhanced";
import ServiceWorkerRegistration from "./ServiceWorkerRegistration";

export default function Page() {
  return (
    <>
      <ServiceWorkerRegistration />
      <PuzzleRPGEnhanced />
    </>
  );
}
