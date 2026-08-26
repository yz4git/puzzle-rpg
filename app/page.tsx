import PuzzleRPGGame from "./PuzzleRPGGame";
import ServiceWorkerRegistration from "./ServiceWorkerRegistration";

export default function Page() {
  return (
    <>
      <ServiceWorkerRegistration />
      <PuzzleRPGGame />
    </>
  );
}
