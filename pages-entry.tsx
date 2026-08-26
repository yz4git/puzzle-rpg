import "./app/globals.css";
import "./app/cart-rogue-mobile-fix.css";
import { createRoot } from "react-dom/client";
import CartRogueGamePhase13 from "./app/CartRogueGamePhase13";
import SkyDancerColorGradeV31 from "./app/SkyDancerColorGradeV31";
import SkyDancerHudV30 from "./app/SkyDancerHudV30";
import SkyDancerHudV31 from "./app/SkyDancerHudV31";
import SkyDancerHudV32 from "./app/SkyDancerHudV32";

const mount = document.getElementById("root");
if (!mount) throw new Error("Sky Dancer mount element is missing");
createRoot(mount).render(<>
  <CartRogueGamePhase13 />
  <SkyDancerColorGradeV31 />
  <SkyDancerHudV30 />
  <SkyDancerHudV31 />
  <SkyDancerHudV32 />
</>);
