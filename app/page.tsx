import CartRogueGame from "./CartRogueGamePhase13";
import ServiceWorkerRegistration from "./ServiceWorkerRegistration";
import SkyDancerColorGradeV31 from "./SkyDancerColorGradeV31";
import SkyDancerHudV30 from "./SkyDancerHudV30";
import SkyDancerHudV31 from "./SkyDancerHudV31";
import SkyDancerHudV32 from "./SkyDancerHudV32";

export default function Page() {
  return <>
    <ServiceWorkerRegistration />
    <CartRogueGame />
    <SkyDancerColorGradeV31 />
    <SkyDancerHudV30 />
    <SkyDancerHudV31 />
    <SkyDancerHudV32 />
  </>;
}
