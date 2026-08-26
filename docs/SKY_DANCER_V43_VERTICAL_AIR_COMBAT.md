# Sky Dancer V43 — Vertical Air Combat

V43 adds a Sky Dancer-only vertical flight layer without converting the shared Cart simulation to a full 3D vehicle model.

## Aircraft

- Enemy aircraft may fly from 10 m below to 10 m above player altitude.
- Altitude changes use bounded climb/descent velocity and acceleration.
- Aircraft pitch follows vertical velocity, so climbing and descending read as aircraft motion rather than vertical translation.
- Stable per-aircraft wander targets keep the formation from collapsing to one plane.

## Collision avoidance

- Predicted player conflicts can trigger climb/dive avoidance.
- Nearby enemy pairs choose opposite vertical lanes when their horizontal and vertical separation becomes unsafe.
- Once safe vertical clearance is established, the Sky Dancer horizontal avoidance layer stops applying emergency 2D radial separation, allowing believable over/under passes.
- At 3.2 m or more of vertical separation, V43 also suppresses the inherited Cart 2D player-contact/Turbo-RAM bubble for that aircraft during the legacy simulation pass. Real enemy x/z state is restored immediately afterward, so altitude is genuine collision clearance rather than a visual-only offset.
- The legacy filter is installed only by the Sky Dancer V43 module; shared Cart gameplay code is unchanged.

## Missiles

- Enemy and player missiles carry altitude and pitch state.
- Lock/range and collision calculations are 3D.
- Player lock controls remain horizontal and simple; the missile seeker resolves vertical separation after launch.
- Missile yaw and pitch are rate limited.
- Missile speed ramps from launch speed toward a higher sustained speed under thrust, rather than instantly moving at one fixed vector.
- Steering authority ramps up after launch to preserve rocket-like inertia.

## Presentation and validation

- Enemy aircraft roots render at simulated altitude and pitch.
- Enemy missile meshes render with 3D altitude/pitch.
- Player missiles receive dedicated 3D visuals so vertical seeker motion is visible.
- WebDriver exposes `__skyDancerGetV43VerticalFlight` for real-WebGL validation.
- Unit tests enforce the ±10 m envelope, aircraft pitch, vertical collision separation, altitude-aware legacy contact filtering and 3D swept missile collision.
- The WebGL workflow includes a V43 vertical-air-combat playcheck in addition to all pre-existing V36–V42, boss, Turbo and full-stage gates.
