import PuzzleRPGGraphicsV2 from "./PuzzleRPGGraphicsV2";
import ServiceWorkerRegistration from "./ServiceWorkerRegistration";

export default function Page() {
  return (
    <>
      <ServiceWorkerRegistration />
      <PuzzleRPGGraphicsV2 />
    </>
  );
}
