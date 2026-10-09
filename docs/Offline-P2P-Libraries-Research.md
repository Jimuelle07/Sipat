# Bagyo Buddy: Offline Phone-to-Phone Communication Libraries

**Research brief for a React Native, Android-first typhoon-preparedness app**
Prepared 2026-10-09. Repository and package metadata was fetched live from the GitHub API and the npm registry on 2026-10-09 UTC.

---

## TL;DR

| | Choice | Why |
|---|---|---|
| **Primary (10-hour build)** | **`expo-nearby-connections`** (MIT wrapper) on top of **Google Nearby Connections** (proprietary, part of Google Play services) | One API covers discovery, connection, encryption and transport. It uses Bluetooth, BLE and Wi-Fi and upgrades to the fastest medium. Google documents a "~100 m" radio range and an M-to-N cluster topology. Text payloads go up to about 1 MB. It needs no internet at any point. The JS API is tiny: `startAdvertise` / `startDiscovery` / `requestConnection` / `acceptConnection` / `sendText` / `onTextReceived`. |
| **Fallback (fully open source)** | **`munim-bluetooth`** (Apache-2.0): BLE GATT with both the **central and peripheral roles** in one package | Works on phones without Google Play services, keeps the whole stack open source, and is the only realistic path to **Android-to-iPhone** messaging. The cost is more work: you handle role logic, MTU and chunking yourself, and range is shorter (BLE). |
| **Longer range (bonus, hardware)** | **Meshtastic** LoRa nodes (GPL-3.0 firmware), with phones paired over BLE | Kilometre-class reach for a barangay block. Needs US$18–60 nodes, and you must confirm NTC legality for the chosen band. |

**Biggest traps to plan for:**
- **Android 12+ permissions.** Request "Nearby devices" (`BLUETOOTH_SCAN`, `BLUETOOTH_ADVERTISE`, `BLUETOOTH_CONNECT`) at runtime.
- **Android 13+ permissions.** Request `NEARBY_WIFI_DEVICES` at runtime.
- **Android 10/11 location.** Request `ACCESS_FINE_LOCATION`, and the device's **Location toggle must be ON** for BLE scans.
- **No Expo Go.** You need a dev build.
- **Nearby Connections requires Google Play services.** Phones without Play services (for example, newer Huawei models) are excluded.
- **No cross-platform Nearby or Multipeer.** Android cannot connect to iPhone through Nearby or Multipeer. Only BLE GATT crosses platforms.

---

## 1. How to read this report

- **License** is the SPDX id from the GitHub API, the npm registry, or the license file itself. Mismatches between sources are called out.
- **Maintenance** uses this format: latest release (date) · last push · ★ GitHub stars · npm weekly downloads. All values were fetched 2026-10-09.
- **Range** figures fall into two kinds:
  - **cited** figures come from an official spec or doc;
  - **est.** figures are engineering planning estimates for two ordinary phones indoors. **Test on your actual phones.** Walls, bodies, phone orientation and the phone's antenna dominate real-world range.
- **Battery** ratings are qualitative engineering assessments, not measurements.
- **⚠ Unverified** marks claims we could not confirm against a primary source.
- Permission sets are abbreviated in the tables and expanded in §4:
  - **P-BLE**: Bluetooth LE / Classic permissions
  - **P-WIFI**: Wi-Fi Direct / Aware / hotspot permissions
  - **P-NC**: Nearby Connections permissions

---

## 2. Comparison tables

### 2A. React Native packages (directly installable)

| Option | License (verified) | Transport | Realistic indoor range | Devices / mesh | Platforms | RN support | Fully offline incl. first pairing? | Perms | Battery | Maintenance | Link |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **expo-nearby-connections** | MIT (npm + repo badge). Underlying Android transport = Google Play services Nearby (**proprietary**) | Google Nearby Connections on Android (BT, BLE, Wi-Fi); Apple Multipeer on iOS | ~100 m "radio range" (**cited**, Google strategies page); est. 20–60 m through walls depending on the medium negotiated | `P2P_CLUSTER` M-to-N, `P2P_STAR` 1-to-N, `P2P_POINT_TO_POINT`. No documented device cap. Not multi-hop (app-level relay possible, see §6) | Android + iOS; **Android↔iOS not supported** (README) | Direct package (Expo module, Nitro). **Requires New Architecture**; v1.1.0 is tested with Expo 55 / RN 0.83. Dev build only | **Yes.** Discovery, connect and data need no internet. Needs Google Play services on Android | P-NC | Moderate–high while advertising and discovering continuously; stop discovery when idle | v1.1.1 (2026-08-20) · 2026-08-20 · ★30 · 399/wk | [GitHub](https://github.com/puguhsudarma/expo-nearby-connections) |
| **munim-bluetooth** | Apache-2.0 (npm) | BLE GATT central **and** peripheral, BLE L2CAP, Android BT Classic RFCOMM, iOS Multipeer | BLE: est. 5–10 m through one wall (cautious), up to ~10–30 m open space | Multiple centrals can connect to one peripheral at once (README). No built-in mesh | Android + iOS (BLE GATT works **across** platforms) | Direct package (Nitro, **RN ≥ 0.78**, Expo SDK 50+ dev build; not Expo Go) | **Yes.** No pairing/bonding needed for plain GATT | P-BLE | Low–moderate (BLE). Supports a low-power scan mode and an Android `connectedDevice` foreground service | v0.9.1 (2026-10-08) · 2026-10-08 · ★24 · 5,106/wk. Very active but young | [GitHub](https://github.com/munimtechnologies/munim-bluetooth) |
| react-native-ble-plx | **GitHub: Apache-2.0; npm: MIT** (mismatch) | BLE **central only**. README lists "communicating between phones using BLE (Peripheral support)" as **not supported** | BLE (as above) | Connects to many peripherals; no peer role | Android + iOS | Direct package, Expo config plugin, dev build | Yes | P-BLE (scan + connect) | Low–moderate | v3.5.1 (2026-02-18) · 2026-03-09 · ★3,444 · 163,146/wk | [GitHub](https://github.com/dotintent/react-native-ble-plx) |
| react-native-ble-manager | Apache-2.0 | BLE central (no GATT-server API documented) | BLE | As above | Android + iOS | Direct package | Yes | P-BLE | Low–moderate | v12.5.3 (2026-09-21) · 2026-09-21 · ★2,335 · 104,922/wk | [GitHub](https://github.com/innoveit/react-native-ble-manager) |
| react-native-multi-ble-peripheral | MIT (npm) | BLE **peripheral only** (GATT server, write events, notifications). Pair it with ble-plx or ble-manager for the central side | BLE | Several centrals per peripheral | Android + iOS | Direct package. **README requires a manual patch when building on Android SDK 33+** | Yes | P-BLE (advertise + connect) | Low | v0.1.8 (2025-11-29) · 2025-11-29 · ★13 · 368/wk | [GitHub](https://github.com/mybigday/react-native-multi-ble-peripheral) |
| react-native-ble-nitro | MIT | BLE central (Nitro); peripheral role ⚠ not verified | BLE | n/a | Android + iOS | Direct package (RN ≥ 0.76) | Yes | P-BLE | Low–moderate | v1.15.1 (2026-07-10) · ★148 · 1,109/wk | [GitHub](https://github.com/zykeco/react-native-ble-nitro) |
| react-native-ble-advertiser | MIT (npm). Repo **archived** | BLE advertising / scanning only (no data channel) | BLE | Broadcast | Android + iOS | Legacy native module | Yes | P-BLE | Low | npm 0.0.17 (2022-09-27) · archived · ★65 | [GitHub](https://github.com/vitorpamplona/react-native-ble-advertiser) |
| react-native-ble-peripheral (himelbrand) / react-native-peripheral (petrbela) | MIT / MIT | BLE peripheral | BLE | n/a | Android + iOS / **iOS only** | Legacy | Yes | P-BLE | Low | npm 2.0.1 (2019-05-29) / 0.0.3 (2019-12-21): **stale** | [himelbrand](https://github.com/himelbrand/react-native-ble-peripheral), [petrbela](https://github.com/petrbela/react-native-peripheral) |
| **react-native-wifi-p2p** | **ISC per npm**; GitHub detects no license file (⚠ license file not found in repo) | Wi-Fi Direct (Android) plus built-in message and file send | Wi-Fi Alliance: "up to 200 m" best case (**cited**); est. 20–50 m indoors | One group owner + N clients. Spec guarantees only ≥ 1 client; studies saw 4–10 on tested phones. `sendMessage` is client → group owner | **Android only** | Direct package (legacy bridge; New Architecture not documented) | Yes, but receiving phone may show a **system Accept dialog** (AOSP) | P-WIFI | High (Wi-Fi radio + group owner) | v3.6.1 (2025-12-26) · ★207 · 394/wk | [GitHub](https://github.com/kirillzyusko/react-native-wifi-p2p) |
| react-native-wifi-aware | MIT | Wi-Fi Aware (NAN): discovery, PIN pairing, encrypted data path | Wi-Fi-class (Wi-Fi Alliance: "typical Wi-Fi range"); est. 20–50 m indoors | Peer-to-peer data paths; multi-peer ⚠ not verified | Android API 26+ **with NAN hardware**; iOS 26+. **iPhone↔Android not supported** (README) | Direct package (Nitro) | Yes | P-WIFI | Moderate–high | npm 0.1.0 (2026-09-21) · ★56 · 13/wk. **Brand new** | [GitHub](https://github.com/mahdidavoodi7/react-native-wifi-aware) |
| react-native-bluetooth-classic | MIT | Bluetooth Classic RFCOMM (SPP) client + server | est. ~10 m class (phones are typically Class 2) | 1-to-1 sockets (multiple sockets possible) | Android. iOS only through MFi External Accessory (**not phone-to-phone**) | Direct package (legacy bridge; New Architecture not formally supported) | Yes, but normally needs **system pairing/discoverability dialogs** | P-BLE (connect / scan) | Moderate | 1.73.0-rc.17 (2025-11-19) · ★267 · 20,426/wk | [GitHub](https://github.com/kenjdavidson/react-native-bluetooth-classic) |
| **Hotspot/LAN combo:** react-native-tcp-socket + react-native-zeroconf (+ react-native-wifi-reborn, react-native-udp) | MIT / MIT / ISC / MIT | One phone turns on its **mobile hotspot** (works with no SIM or data); others join; discover through mDNS; exchange data over TCP/UDP sockets | Wi-Fi-class; est. 20–50 m indoors | Hotspot client limit set by the phone (often ~5–10, ⚠ varies by OEM); star topology | Android + iOS (iPhone can join an Android hotspot) | Direct packages | Yes. Users must turn on the hotspot manually (apps cannot toggle tethering) and type the password, or use a QR code | P-WIFI (and Local Network permission on iOS) | **High for the hotspot phone** | tcp-socket v6.4.3 (2026-09-10) · ★395 · 89,908/wk; zeroconf 0.17.4 (2026-10-07) · ★250; wifi-reborn 4.13.6 (2025-06-25) · ★463; udp 4.1.7 (2023-01-26) **stale** | [tcp-socket](https://github.com/Rapsssito/react-native-tcp-socket), [zeroconf](https://github.com/balthazar/react-native-zeroconf), [wifi-reborn](https://github.com/JuanSeBestia/react-native-wifi-reborn) |
| react-native-multipeer-connectivity / react-native-multipeer | MIT / MIT | Apple Multipeer (**deprecated by Apple**) | Wi-Fi / BT-class | Small groups | **iOS only** | Legacy | Yes | iOS Local Network + Bluetooth | Moderate | 0.1.0 (2023-09-12) · ★11 / npm 0.1.1 (2015): **stale** | [XHMM](https://github.com/XHMM/react-native-multipeer-connectivity) |
| Old Nearby wrappers: react-native-google-nearby-connection, expo-googlenearby-connection, react-native-nearby-api | MIT / MIT / ISC | Nearby Connections (Android only) | — | — | Android | Legacy | — | P-NC | — | 0.0.9 (2018) · ★45 / 0.1.4 (2025-01-28) · ★0 / 0.0.5 (2017): **avoid** | npm |

### 2B. Native / cross-platform libraries and open-source mesh projects (would need a native bridge)

| Option | License (verified) | Transport | Realistic indoor range | Devices / mesh | Platforms | RN support | Fully offline incl. first pairing? | Battery | Maintenance | Link |
|---|---|---|---|---|---|---|---|---|---|---|
| **bitchat** (iOS/macOS) | **Unlicense** (public domain; LICENSE file verified) | BLE mesh; Nostr for internet mode | Whitepaper estimate: BLE 10–30 m per hop | Multi-hop flooding, **TTL 7**, message-ID dedup | iOS / macOS | None. Use as a **protocol reference** | Yes (mesh mode) | Duty-cycled BLE | v1.7.1 (2026-07-31) · 2026-10-04 · ★36,506 | [GitHub](https://github.com/permissionlesstech/bitchat) |
| **bitchat-android** | **GPL-3.0 in LICENSE.md**, but README says "public domain" (**conflict**; treat as GPL-3.0) | BLE mesh (each phone is central + peripheral, max 7 hops); Wi-Fi Aware transport present in code | As above | Multi-hop mesh, fragmentation, TTL routing | Android API 26+ | A Kotlin **app**, not a library. Bridging means extracting the mesh service yourself. **GPL copyleft applies** | Yes | Adaptive duty cycling, foreground service | v2.0.1 (2026-08-11) · 2026-10-06 · ★7,763 | [GitHub](https://github.com/permissionlesstech/bitchat-android) |
| **Meshrabiya** | LGPL-3.0 | Multi-hop Wi-Fi mesh over Wi-Fi Direct groups and Local-Only Hotspots, virtual IPs, TCP/UDP socket factories | Wi-Fi-class per hop | Multi-hop; each node runs a hotspot and joins one upstream | Android only | Kotlin library; needs a custom native module. Peers join with a **QR "connect link"** | Yes | High (Wi-Fi hotspot on every node) | 0.1d11 (2023-11-06) · 2024-12-17 · ★198. **Early stage, low activity** | [GitHub](https://github.com/UstadMobile/Meshrabiya) |
| **Briar / Bramble** | GPL-3.0 (LICENSE.txt, GPLv3) | Bluetooth, Wi-Fi (also Tor when online) | BT / Wi-Fi class | **One-hop "social mesh"** between existing contacts (Briar's own research report). Not a general relay mesh | Android (+ desktop) | No SDK. App code only | Yes (contacts exchanged in person) | Moderate | GitHub mirror push 2026-10-06 · ★706 (main dev at code.briarproject.org) | [GitHub](https://github.com/briar/briar) |
| **Berty / Wesh network** | Apache-2.0 **or** MIT (COPYRIGHT file verified for weshnet) | Android Nearby, iOS Multipeer, BLE for inter-OS; libp2p | BT / Wi-Fi class | Direct exchange between connected devices plus sync; not a relay mesh | Android + iOS | Go + gomobile. Heavy for a hackathon (`weshnet-expo` exists) | Yes | Moderate | weshnet v2.3.0 (2025-05-23) · 2026-10-02 · ★252; berty ★9,316 | [GitHub](https://github.com/berty/weshnet) |
| Google `nearby` C++ / Swift codebase | Apache-2.0 | Nearby Connections protocol implementation (used for Windows, ChromeOS, Swift package) | — | Same strategies | Swift package for iOS. iOS reportedly Wi-Fi LAN only (⚠ not re-verified) | Not packaged for RN | Yes | — | push 2026-10-09 · ★980 | [GitHub](https://github.com/google/nearby) |
| Nordic Android-BLE-Library | ⚠ license not re-checked in this pass | BLE central helper (Kotlin) | BLE | — | Android | Would need bridging; RN packages already cover this | Yes | Low | 2.11.0 (2025-09-11) · ★2,418 | [GitHub](https://github.com/NordicSemiconductor/Android-BLE-Library) |
| Nordic Android-nRF-Mesh-Library | BSD-3-Clause | **Bluetooth SIG Mesh** provisioning/proxy for mesh *nodes* (bulbs, sensors) | — | SIG mesh among dedicated nodes. **Phones are not mesh relays here: not suitable** | Android | — | Yes | — | 3.5.0 (2026-09-24) · ★477 | [GitHub](https://github.com/NordicSemiconductor/Android-nRF-Mesh-Library) |
| Serval Mesh (batphone) | GPL-3.0 | Wi-Fi ad-hoc mesh | — | Mesh | Android | — | — | — | Last push 2018: **dead** | [GitHub](https://github.com/servalproject/batphone) |

### 2C. Proprietary / closed options (for comparison only; NOT open source)

| Option | License | Transport | Range | Devices / mesh | Platforms | RN support | Fully offline incl. first pairing? | Notes | Link |
|---|---|---|---|---|---|---|---|---|---|
| **Google Nearby Connections (Android)** | **Proprietary**: ships inside Google Play services (`play-services-nearby`). A related Apache-2.0 implementation exists in `google/nearby` (above) | BT, BLE, Wi-Fi (Direct / hotspot / LAN), with automatic upgrade to the highest-bandwidth medium | "~100 m" radio range (**cited**) | Cluster M-to-N, Star 1-to-N, Point-to-point. No documented cap | Android (Play services). iOS through Google's Swift package | Through `expo-nearby-connections` | **Yes**: "even without internet access". Requires Play services on device. Both sides must accept each connection (can be automated in code) | BYTES payload max **1,047,552 bytes** | [Docs](https://developers.google.com/nearby/connections/overview) |
| **Bridgefy SDK** | **Proprietary** (Bridgefy SDK License Agreement; pricing not published). The RN wrapper `bridgefy-react-native` is MIT, but the native SDK is not | BLE mesh (Bridgefy also lists Wi-Fi Direct) | ⚠ not published | Multi-hop mesh; size depends on nearby devices | Android + iOS | `bridgefy-react-native` v1.2.4 (2026-07-01) · ★32 · 2,435/wk | **No for first run**: docs say "An Internet connection is needed, at least for the first time to validate the license." After that, mesh is fully offline | Strongest turnkey mesh, but needs an API key, online activation, and commercial terms | [Docs](https://docs.bridgefy.me/sdk/ios/usage) · [RN](https://github.com/bridgefy/bridgefy-react-native) |
| **Ditto** | **Proprietary** binary license (npm: "SEE LICENSE IN LICENSE.md") | P2P sync over BLE, Wi-Fi (platform-specific), LAN; a sync database, not just a transport | ⚠ not published | P2P mesh sync | Android + iOS | `@dittolive/ditto` v5.1.0 (2026-08-19) · 6,139/wk; RN CLI or Expo dev build (no Expo Go) | Docs document a **"Local Only Mode (No Internet)"**. You still create a database id in Ditto's portal on your dev machine (⚠ whether production P2P needs a paid license: confirm with Ditto) | Excellent for syncing checklist state; licensing is the risk | [RN install](https://docs.ditto.live/sdk/latest/install-guides/react-native) |
| **Apple Multipeer Connectivity** | Apple OS framework (closed). **Deprecated:** Apple says "Xcode 27 deprecates the entire Multipeer Connectivity framework" (TN3213) | Wi-Fi infra, Apple P2P Wi-Fi, Bluetooth | — | Small sessions | Apple only. **Android cannot join** | Wrappers above | Yes | Do not build new work on it | [Apple](https://developer.apple.com/documentation/multipeerconnectivity) |
| **Apple Wi-Fi Aware framework** | Apple OS framework (closed) | Wi-Fi Aware (NAN) | Wi-Fi class | P2P | iOS 26+ on iPhone 12 and later; needs the `com.apple.developer.wifi-aware` entitlement | `react-native-wifi-aware` | Yes | Standards-based. Android interop is possible in principle; the RN lib does not support it | [Apple](https://developer.apple.com/documentation/wifiaware) |

### 2D. Hardware-assisted, longer range (separate category)

| Option | License | Hardware | Range | Mesh | Phone link | RN path | Offline? | Maintenance | Link |
|---|---|---|---|---|---|---|---|---|---|
| **Meshtastic** | Firmware **GPL-3.0**; Android app GPL-3.0; JS `@meshtastic/core` **GPL-3.0-only** (copyleft affects your app if you bundle it) | LoRa boards. Vendor list prices (USD, excl. shipping/tax/antenna): Heltec WiFi LoRa 32 V3 ~$17.90–19.90; RAK WisBlock Meshtastic Starter Kit ~$24.99–60.99; LILYGO T-Echo ~$44.61 | Meshtastic docs' preset planning figures: ~3 km Short Fast, ~10 km Long Fast, ~20 km Long Moderate (flat terrain, modest antennas). A Philippine field test (Light of Hope PH, Seeed blog) reported a 31.07 km one-hop link using a mountain relay | Managed flood mesh, multi-hop | Phone ↔ node over **BLE**; LoRa between nodes | `@meshtastic/core` (v2.6.7, 2025-09-11) works in JS, but the official BLE transport is **Web Bluetooth only**. You would write an RN BLE transport using ble-plx or munim-bluetooth | Yes | firmware ★8,396, latest GitHub release v2.7.26 (2026-06-24), push 2026-10-09; Android app v2.8.2 (2026-09-25) | [Meshtastic](https://meshtastic.org/docs/development/js/) |
| **Reticulum** (+ RNode LoRa) | **Reticulum License**: MIT-style plus field-of-use restrictions (no systems built to harm humans, no AI/ML training-dataset use). Our assessment: source-available, **not OSI-approved open source** | LoRa (RNode), packet radio, Wi-Fi, etc. | Medium-dependent | Full routed mesh network stack | Python; Sideband app | No RN path | Yes | v1.5.5 (2026-09-29) · ★7,498 | [GitHub](https://github.com/markqvist/Reticulum) |
| disaster.radio | No license detected by GitHub API (⚠) | ESP32 + LoRa, solar | LoRa class | Mesh | Wi-Fi web UI | — | Yes | push 2026-05-22 · ★1,131 (low activity) | [GitHub](https://github.com/sudomesh/disaster-radio) |

**Philippines LoRa legality.** Meshtastic firmware defines `PH_433` (433.0–434.7 MHz), `PH_868` (868.0–869.4 MHz) and `PH_915` (915–918 MHz). Firmware comments note NTC-approved equipment for 433/868, and **250 mW EIRP, no external antenna** for 915. These are firmware definitions, **not** NTC approval. NTC MC 03-05-2007 lists generic SRD use at 433.050–434.790 MHz at 10 mW ERP, and specific 868–870 MHz sub-bands (generally 25 mW ERP), with type approval and registration requirements. **Confirm the device, band, antenna and power with NTC before deploying.** We could not retrieve the text of NTC MC 03-08-2013 (the 915 MHz WDN amendment). ⚠

---

## 3. Recommendation for a 10-hour React Native hackathon build

### Primary: `expo-nearby-connections` (Google Nearby Connections under the hood)

**Why it wins for a hackathon**
1. **Fewest moving parts.** Google's stack handles discovery (BLE/BT), connection, authentication tokens, encryption, and medium upgrade (BT → Wi-Fi). You write about 100 lines of TypeScript, not a GATT protocol.
2. **Meets the range target.** Google documents "~100 m" radio range for Cluster and Star strategies. A household plus its yard is realistic once the link upgrades to Wi-Fi.
3. **Multiple family phones at once.** `P2P_CLUSTER` gives M-to-N connections, enough for a household. Add the app-level relay in §6 to reach a neighbour's phone through a family member's phone.
4. **Payload headroom.** BYTES payloads go up to 1,047,552 bytes; your JSON is a few KB.
5. **Truly offline.** No account, no API key, no license activation, no internet at any step.

**Accept these trade-offs consciously**
- **The transport is closed source** (Play services). The wrapper is MIT. If "100% open source" is a judging criterion, swap primary and fallback.
- **Requires Google Play services.** Phones without Play services (e.g., post-2019 Huawei) won't work. Detect this and fall back to BLE.
- **Version requirements.** v1.1.x needs the **New Architecture** with Expo SDK 55 / RN 0.83. Bare RN projects can use Expo modules after running `npx install-expo-modules`.
- **Young package.** It has 30 stars and one maintainer. **Spike it first:** get two phones exchanging "hello" before building any UI.
- **No Android↔iOS.** iOS uses Multipeer and only talks to iPhones.

### Fallback: `munim-bluetooth` (BLE GATT, fully open source)

Use it if:
- the Nearby spike fails on your phones;
- a target phone lacks Play services;
- you need iPhone↔Android; or
- you need an all-open-source stack.

**Pattern:** every phone **advertises** a Bagyo Buddy service UUID and hosts one write+notify characteristic (peripheral). Every phone also **scans** for that UUID and connects (central). A tie-break, such as "lower device-id initiates", avoids double links. Messages are UTF-8 JSON, hex-encoded, chunked to `getMaximumWriteLength()`.

**Costs:**
- Shorter range (BLE: plan 5–10 m through a wall; est.).
- You implement chunking and acknowledgements.
- RN ≥ 0.78 is required.
- The package is young: v0.9.1, 24 stars, but very active, with a 5k/wk download rate.

**Plan C (if both fail):** use one phone's **mobile hotspot** (works without a SIM) as a LAN. Others join it; use `react-native-zeroconf` for discovery and `react-native-tcp-socket` for the data. All are MIT, mature and boring, which is good. The downsides are the manual hotspot toggle and battery drain on the hotspot phone.

### Suggested build order (sequence, not timings)
1. Bare RN or Expo dev build on **two physical Android phones**. Emulators have no usable BT/Wi-Fi P2P.
2. Permission screen (§4). Prompt to turn on Bluetooth, Wi-Fi and Location (Android 10/11).
3. Nearby spike: advertise, discover, connect, `sendText("hello")`.
4. Message envelope + dedupe + relay (§6). Persist to local storage (AsyncStorage / SQLite / MMKV) so check-ins survive restarts.
5. UI: "I'm safe" button, checklist sync, family message list.
6. If time remains: BLE fallback, a "family code" to filter strangers, and a foreground service for screen-off operation.

### Known pitfalls (with sources)

**Android permissions by version** [S1][S2]

| Android | Bluetooth / BLE | Wi-Fi Direct / Aware / LocalOnlyHotspot |
|---|---|---|
| 10–11 (API 29–30) | `ACCESS_FINE_LOCATION` (runtime) + legacy `BLUETOOTH` / `BLUETOOTH_ADMIN`. **Location services must be ON** or BLE scanning is off [S7] | `ACCESS_FINE_LOCATION` |
| 12 (API 31–32) | Runtime `BLUETOOTH_SCAN` (with `usesPermissionFlags="neverForLocation"` if you don't derive location), `BLUETOOTH_ADVERTISE`, `BLUETOOTH_CONNECT` ("Nearby devices" group). Keep legacy permissions with `maxSdkVersion="30"` | `ACCESS_FINE_LOCATION` |
| 13+ (API 33+) | Same as 12 | Runtime **`NEARBY_WIFI_DEVICES`** (can be flagged `neverForLocation`) covers `discoverPeers()`, `connect()`, Wi-Fi Aware `attach/publish/subscribe`, `startLocalOnlyHotspot()` |
| 14+ (API 34+) | Foreground service needs `android:foregroundServiceType="connectedDevice"` + `FOREGROUND_SERVICE_CONNECTED_DEVICE`, and a granted BT runtime permission [S5]. First GATT MTU request is fixed at 517; later requests are ignored, so use the negotiated value [S9] | Same |

**Exact Nearby Connections manifest set (Google's doc)** [S12]:
- `ACCESS_WIFI_STATE` and `CHANGE_WIFI_STATE` (max 31)
- `BLUETOOTH` and `BLUETOOTH_ADMIN` (max 30)
- `ACCESS_COARSE_LOCATION` (max 28)
- `ACCESS_FINE_LOCATION` (29–31)
- `BLUETOOTH_ADVERTISE`, `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN` (31+)
- `NEARBY_WIFI_DEVICES` (32+)
- `ACCESS_LOCAL_NETWORK` (37+, for Wi-Fi LAN on SDK 37 targets)

**Other pitfalls**
- **Background limits.** BLE scanning works while the process is alive. Android throttles scan starts (5 starts per 30 s; `SCAN_FAILED_SCANNING_TOO_FREQUENTLY`) [S6][S8]. Many budget OEM skins kill background apps aggressively (⚠ general field experience, not a cited spec). For the demo, keep the app in the foreground. For production, use a `connectedDevice` foreground service and ask users to exempt the app from battery optimisation.
- **Pairing UX.**
  - Nearby requires **both sides to accept**. You can auto-accept in code, but show the auth token or a family code to avoid strangers joining [S13].
  - Wi-Fi Direct may show a **system invitation dialog** on the receiving phone (AOSP behaviour) [S4].
  - Bluetooth Classic usually needs a **system pairing dialog**.
  - BLE GATT needs **no pairing** for plain characteristics.
- **iOS restrictions.**
  - No public Wi-Fi Direct API [S34].
  - Multipeer is Apple-only and now deprecated [S31].
  - Backgrounded iOS peripherals drop the local name and move service UUIDs to an "overflow area" that only iOS scanners see [S33]. Android cannot reliably discover a backgrounded iPhone.
  - Wi-Fi Aware needs iOS 26 + iPhone 12 or later + an entitlement [S32].
  - **For cross-platform, the only practical path is BLE GATT with the app in the foreground.**
- **BLE data size.** The default ATT MTU is 23, so 20-byte payloads until MTU negotiation. Always chunk by bytes, not string length [S45].
- **GATT error 133** is a generic failure: serialise operations, close the GATT on failure, retry with backoff [S45].
- **Wi-Fi Direct with RN** (if you go there): `sendMessage` goes client → group owner only. Runtime `NEARBY_WIFI_DEVICES` is required on 13+ (issue #96). Discovery problems on Android 10 trace to permissions (#101). Test on real devices only (#98) [S21].
- **Wi-Fi Aware hardware.** It is optional hardware. Check `hasSystemFeature(FEATURE_WIFI_AWARE)` and `isAvailable()`, and don't count on it on budget phones [S3].
- **BLE Coded PHY ("long range")** exists on some phones. Check with `isLeCodedPhySupported()`; both phones must support it [S51].
- **Expo Go** cannot load any of these native modules. Use a dev build (`npx expo run:android`).

---

## 4. Permission sets referenced in the tables
- **P-BLE**: Android 12+: `BLUETOOTH_SCAN` (neverForLocation), `BLUETOOTH_CONNECT`, plus `BLUETOOTH_ADVERTISE` if acting as a peripheral. Android ≤ 11: `ACCESS_FINE_LOCATION` + legacy BT permissions + Location toggle ON. iOS: `NSBluetoothAlwaysUsageDescription` (+ `bluetooth-central` / `bluetooth-peripheral` background modes if needed).
- **P-WIFI**: Android 13+: `NEARBY_WIFI_DEVICES` (neverForLocation); ≤ 12: `ACCESS_FINE_LOCATION`; plus `ACCESS_WIFI_STATE` / `CHANGE_WIFI_STATE`. iOS: Local Network usage description (+ Bonjour service types).
- **P-NC**: the Nearby Connections set in §3 (Bluetooth + location + Wi-Fi state + `NEARBY_WIFI_DEVICES`). iOS (Multipeer side): Bluetooth + Local Network + Bonjour name (the expo plugin sets these).

---

## 5. Minimal integration sketch: `expo-nearby-connections` (TypeScript)

API names below are taken from the package README (v1.1.x): `startAdvertise`, `startDiscovery`, `onPeerFound`, `requestConnection`, `onInvitationReceived`, `acceptConnection`, `onConnected`, `onDisconnected`, `sendText`, `onTextReceived`, `Strategy`.

⚠ The README shows advertiser and discoverer as separate screens. Running both on one phone (cluster mode) is supported by Nearby Connections itself but was not verified for this wrapper. If it conflicts on your phones, use **hub mode**: the parent's phone advertises with `Strategy.P2P_STAR` and the others only discover.

```bash
npx expo install expo-nearby-connections react-native-nitro-modules
# app.json -> "plugins": [["expo-nearby-connections", { "bonjourServicesName": "bagyobuddy" }]]
npx expo prebuild --clean && npx expo run:android     # dev build on a real phone
```

```ts
// mesh.ts: Bagyo Buddy offline link (sketch, not production code)
import { PermissionsAndroid, Platform } from "react-native";
import {
  Strategy, startAdvertise, startDiscovery, stopAdvertise, stopDiscovery,
  onPeerFound, onPeerLost, requestConnection, onInvitationReceived,
  acceptConnection, rejectConnection, onConnected, onDisconnected,
  sendText, onTextReceived,
} from "expo-nearby-connections";

export type BBMessage = {
  id: string;            // unique id for dedupe (e.g. `${deviceId}-${Date.now()}-${rand}`)
  type: "chat" | "safe" | "checklist";
  from: string;          // sender deviceId
  name: string;          // display name, e.g. "Nanay"
  ts: number;
  ttl: number;           // relay hops left (e.g. 3)
  body: unknown;         // small JSON payload
};

const FAMILY = "DELACRUZ";                 // shared family code typed once in settings
const ME = { deviceId: "a1b2c3", name: "Kuya" };
const ADV_NAME = `BB|${FAMILY}|${ME.deviceId}|${ME.name}`;   // encode identity in the endpoint name

const connected = new Set<string>();       // peerIds with an open connection
const seen = new Set<string>();            // message ids already handled

// 1) Runtime permissions (Android 10 to 14+)
export async function ensurePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const v = Platform.Version as number;
  const P = PermissionsAndroid.PERMISSIONS;
  const perms =
    v >= 33 ? [P.BLUETOOTH_SCAN, P.BLUETOOTH_ADVERTISE, P.BLUETOOTH_CONNECT, P.NEARBY_WIFI_DEVICES, P.ACCESS_FINE_LOCATION]
    : v >= 31 ? [P.BLUETOOTH_SCAN, P.BLUETOOTH_ADVERTISE, P.BLUETOOTH_CONNECT, P.ACCESS_FINE_LOCATION]
    : [P.ACCESS_FINE_LOCATION];            // Android 10/11: also ask the user to switch Location ON
  const res = await PermissionsAndroid.requestMultiple(perms);
  return Object.values(res).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
}

const parse = (name: string) => {
  const [tag, family, deviceId, display] = name.split("|");
  return tag === "BB" ? { family, deviceId, display } : null;
};

// 2) Start: advertise + discover, auto-connect to same-family peers
export async function startMesh(onMessage: (m: BBMessage) => void) {
  if (!(await ensurePermissions())) throw new Error("Permissions denied");

  await startAdvertise(ADV_NAME, Strategy.P2P_CLUSTER);
  await startDiscovery(ADV_NAME, Strategy.P2P_CLUSTER);

  const unsubs = [
    onPeerFound(({ peerId, name }) => {
      const p = parse(name);
      if (!p || p.family !== FAMILY || connected.has(peerId)) return;
      if (ME.deviceId < p.deviceId) requestConnection(peerId);   // tie-break: only one side dials
    }),
    onPeerLost(({ peerId }) => connected.delete(peerId)),
    onInvitationReceived(({ peerId, name }) => {
      const p = parse(name);
      p && p.family === FAMILY ? acceptConnection(peerId) : rejectConnection(peerId);
    }),
    onConnected(({ peerId }) => connected.add(peerId)),
    onDisconnected(({ peerId }) => connected.delete(peerId)),

    // 4) Receive -> dedupe -> deliver -> relay (store-and-forward, see §6)
    onTextReceived(({ peerId, text }) => {
      let msg: BBMessage;
      try { msg = JSON.parse(text); } catch { return; }
      if (seen.has(msg.id)) return;
      seen.add(msg.id);
      onMessage(msg);
      if (msg.ttl > 0) broadcast({ ...msg, ttl: msg.ttl - 1 }, peerId);
    }),
  ];

  return async () => { unsubs.forEach((u) => u()); await stopDiscovery(); await stopAdvertise(); };
}

// 3) Send a small JSON message to every connected peer
export async function broadcast(msg: BBMessage, exceptPeerId?: string) {
  seen.add(msg.id);
  const text = JSON.stringify(msg);        // a few KB; Nearby BYTES limit is ~1 MB
  await Promise.allSettled(
    [...connected].filter((p) => p !== exceptPeerId).map((p) => sendText(p, text)),
  );
}

// Usage
// const stop = await startMesh((m) => store.add(m));
// await broadcast({ id: crypto.randomUUID(), type: "safe", from: ME.deviceId, name: ME.name,
//                   ts: Date.now(), ttl: 3, body: { status: "SAFE", note: "Nasa evacuation center" } });
```

### Fallback sketch: `munim-bluetooth` (BLE GATT) outline

Function and event names are from the README. Values are **hex strings**. Check the README for exact `startScan` option fields.

```ts
import { requestBluetoothPermission, setServices, startAdvertising, startScan, connect,
  discoverServices, requestMTU, getMaximumWriteLength, subscribeToCharacteristic,
  writeCharacteristic, updateCharacteristicValue, addEventListener } from "munim-bluetooth";

const SVC = "71f271d0-8f4c-4c4d-8a2d-6f3a9497b41d", CHR = "4ad4a6d2-3f4a-477c-9832-5e0d8f7654d8";
await requestBluetoothPermission(["scan", "connect", "advertise"]);

// Peripheral side (every phone): host one write+notify characteristic and advertise it
setServices([{ uuid: SVC, characteristics: [{ uuid: CHR, properties: ["write", "writeWithoutResponse", "notify"], value: "" }] }]);
startAdvertising({ serviceUUIDs: [SVC], localName: "BB" });
addEventListener("peripheralWriteRequest", ({ value }) => reassemble(value)); // chunks from centrals

// Central side (every phone): find peers advertising SVC and connect
startScan({ serviceUUIDs: [SVC] });                                   // option name per README
addEventListener("deviceFound", async (d) => {
  await connect(d.id); await discoverServices(d.id);
  await requestMTU(d.id, 517);                                         // Android; iOS self-negotiates
  await subscribeToCharacteristic(d.id, SVC, CHR);                     // replies via notifications
  const max = await getMaximumWriteLength(d.id, "withResponse");
  for (const chunk of frame(JSON.stringify(msg), max)) await writeCharacteristic(d.id, SVC, CHR, chunk, "write");
});
addEventListener("characteristicValueChanged", ({ value }) => reassemble(value));
// frame(): UTF-8 encode -> split into [msgId|seq|last|payload] chunks <= max bytes -> hex
// To reply on the peripheral side: updateCharacteristicValue(SVC, CHR, hexChunk, true)
```

---

## 6. Design notes for the typhoon use case
- **Store-and-forward relay** (the bitchat pattern) gives a "poor man's mesh" on top of any 1-hop transport. Each message carries a unique `id` and a `ttl` (bitchat uses 7). Every phone keeps a seen-set, persists messages, and re-sends unseen messages to its other peers with `ttl - 1`. On reconnect, exchange a digest of message ids and push missing ones. This is how a neighbour's "I'm safe" can reach the family through one phone in between.
- **Last-writer-wins checklist state.** Send `{itemId, done, ts, from}` and keep the newest `ts` per item. This avoids heavy CRDT libraries in a hackathon.
- **Battery.** Advertise and discover in bursts (for example, every couple of minutes, or when the user opens the app or taps "Sync now"), not continuously. Show the battery level in check-ins (`body.battery`) so families know whose phone to conserve.
- **Security/privacy.** Use a family code in the endpoint name to filter peers, and optionally HMAC message bodies with it. Do not broadcast precise GPS by default.

---

## 7. What we could not verify (⚠)
- Real indoor ranges for any phone-to-phone transport: no authoritative spec exists. All indoor numbers marked "est." are planning estimates.
- `react-native-wifi-p2p`: no LICENSE file was detected by the GitHub API; ISC is taken from npm metadata only.
- `react-native-ble-plx`: license mismatch between GitHub (Apache-2.0) and npm (MIT).
- bitchat-android: README ("public domain") conflicts with LICENSE.md (GPL-3.0).
- Whether `expo-nearby-connections` allows simultaneous advertise + discover on one device.
- Google Nearby Swift on iOS supporting only Wi-Fi LAN (reported from the repo notes via search; not re-read directly).
- Ditto production licensing for P2P-only deployments; Bridgefy pricing.
- Hotspot client limits per phone model.
- NTC MC 03-08-2013 (915 MHz) text; Meshtastic PH region values are read from firmware source via search and listed as firmware definitions only.
- `react-native-ble-nitro` peripheral support; Nordic Android-BLE-Library license.
- Meshtastic range preset figures and device prices were taken from search results citing Meshtastic docs and vendor stores; they were not re-fetched page by page.

---

## 8. Sources

**Android (official)**
- [S1] Bluetooth permissions: https://developer.android.com/develop/connectivity/bluetooth/bt-permissions
- [S2] Wi-Fi permissions / `NEARBY_WIFI_DEVICES`: https://developer.android.com/develop/connectivity/wifi/wifi-permissions · Android 13 changes: https://developer.android.com/about/versions/13/behavior-changes-13
- [S3] Wi-Fi Aware: https://developer.android.com/develop/connectivity/wifi/wifi-aware · CDD: https://android.googlesource.com/platform/compatibility/cdd/+/refs/heads/master/7_hardware-compatibility/7_4_data-connectivity.md
- [S4] Wi-Fi Direct (P2P): https://developer.android.com/develop/connectivity/wifi/wifip2p · AOSP invitation dialog: https://android.googlesource.com/platform/frameworks/base/+/618455f/wifi/java/android/net/wifi/p2p/WifiP2pService.java
- [S5] Foreground service types: https://developer.android.com/develop/background-work/services/fgs/service-types · https://developer.android.com/about/versions/14/changes/fgs-types-required
- [S6] Background BLE: https://developer.android.com/develop/connectivity/bluetooth/ble/background · ScanCallback: https://developer.android.com/reference/android/bluetooth/le/ScanCallback
- [S7] AOSP BLE (location services and scanning): https://source.android.com/docs/core/connect/bluetooth/ble
- [S8] AOSP scan throttle (5 per 30 s): https://android.googlesource.com/platform/packages/apps/Bluetooth/+/61ca891c486de3f2b42b4619b6095b9eef5b7b47%5E2..61ca891c486de3f2b42b4619b6095b9eef5b7b47/
- [S9] Android 14 behavior changes (MTU 517): https://developer.android.com/about/versions/14/behavior-changes-all

**Google Nearby Connections**
- [S10] Overview ("even without internet access"): https://developers.google.com/nearby/connections/overview
- [S11] Strategies (Cluster / Star / P2P, "~100m"): https://developers.google.com/nearby/connections/strategies
- [S12] Android setup and permissions: https://developers.google.com/nearby/connections/android/get-started
- [S13] Manage connections (both sides accept, auth token): https://developers.google.com/nearby/connections/android/manage-connections
- [S14] `MAX_BYTES_DATA_SIZE` = 1047552: https://developers.google.com/android/reference/com/google/android/gms/nearby/connection/ConnectionsClient · payloads: https://developers.google.com/nearby/connections/android/exchange-data
- [S15] google/nearby (Apache-2.0): https://github.com/google/nearby · connections README: https://github.com/google/nearby/blob/main/connections/README.md

**React Native packages**
- [S16] expo-nearby-connections: https://github.com/puguhsudarma/expo-nearby-connections · https://www.npmjs.com/package/expo-nearby-connections
- [S17] munim-bluetooth: https://github.com/munimtechnologies/munim-bluetooth · https://www.npmjs.com/package/munim-bluetooth
- [S18] react-native-multi-ble-peripheral: https://github.com/mybigday/react-native-multi-ble-peripheral
- [S19] react-native-ble-plx: https://github.com/dotintent/react-native-ble-plx
- [S20] react-native-ble-manager: https://github.com/innoveit/react-native-ble-manager
- [S21] react-native-wifi-p2p: https://github.com/kirillzyusko/react-native-wifi-p2p · issues [#39](https://github.com/kirillzyusko/react-native-wifi-p2p/issues/39), [#96](https://github.com/kirillzyusko/react-native-wifi-p2p/issues/96), [#98](https://github.com/kirillzyusko/react-native-wifi-p2p/issues/98), [#101](https://github.com/kirillzyusko/react-native-wifi-p2p/issues/101), [#103](https://github.com/kirillzyusko/react-native-wifi-p2p/issues/103)
- [S22] react-native-wifi-aware: https://github.com/mahdidavoodi7/react-native-wifi-aware
- [S23] react-native-bluetooth-classic: https://github.com/kenjdavidson/react-native-bluetooth-classic
- [S24] react-native-tcp-socket: https://github.com/Rapsssito/react-native-tcp-socket · react-native-zeroconf: https://github.com/balthazar/react-native-zeroconf · react-native-wifi-reborn: https://github.com/JuanSeBestia/react-native-wifi-reborn · react-native-udp: https://github.com/tradle/react-native-udp

**Open-source mesh projects**
- [S25] bitchat: https://github.com/permissionlesstech/bitchat · bitchat-android LICENSE: https://github.com/permissionlesstech/bitchat-android/blob/main/LICENSE.md · README: https://github.com/permissionlesstech/bitchat-android/blob/main/README.md · whitepaper: https://github.com/jackjackbits/bitchat/blob/main/WHITEPAPER.md
- [S26] Meshrabiya: https://github.com/UstadMobile/Meshrabiya
- [S27] Briar LICENSE: https://github.com/briar/briar/blob/master/LICENSE.txt · public mesh research: https://code.briarproject.org/briar/public-mesh-research/-/wikis/Public-Mesh-Research-Report
- [S28] weshnet COPYRIGHT: https://github.com/berty/weshnet/blob/main/COPYRIGHT · protocol: https://berty.tech/docs/protocol/

**Proprietary SDKs**
- [S29] Bridgefy iOS usage (internet once for license): https://docs.bridgefy.me/sdk/ios/usage · SDK license: https://bridgefy.me/sdk-license-agreement/ · FAQ: https://bridgefy.me/faq/ · RN wrapper: https://github.com/bridgefy/bridgefy-react-native
- [S30] Ditto RN install (Local Only Mode, no Expo Go): https://docs.ditto.live/sdk/latest/install-guides/react-native · license: https://www.ditto.com/sdk-license · pricing: https://www.ditto.com/pricing

**Apple (official)**
- [S31] Multipeer Connectivity (deprecated): https://developer.apple.com/documentation/multipeerconnectivity · TN3213: https://developer.apple.com/documentation/technotes/tn3213-moving-from-multipeer-connectivity-to-network-framework
- [S32] Wi-Fi Aware framework: https://developer.apple.com/documentation/wifiaware
- [S33] CoreBluetooth `startAdvertising` (background overflow area): https://developer.apple.com/documentation/corebluetooth/cbperipheralmanager/startadvertising(_:)
- [S34] TN3111 iOS Wi-Fi API overview: https://developer.apple.com/documentation/technotes/tn3111-ios-wifi-api-overview

**LoRa / Meshtastic / Reticulum / Philippine regulation**
- [S35] Meshtastic firmware (GPL-3.0): https://github.com/meshtastic/firmware · region definitions: https://github.com/meshtastic/firmware/blob/develop/src/mesh/RadioInterface.cpp
- [S36] Meshtastic radio presets / range: https://meshtastic.org/docs/software/android/user/settings-radio-user/ · https://meshtastic.org/docs/configuration/radio/lora/ · range tests: https://meshtastic.org/docs/overview/range-tests/
- [S37] Meshtastic JS: https://meshtastic.org/docs/development/js/ · https://www.npmjs.com/package/@meshtastic/core
- [S38] Reticulum LICENSE: https://github.com/markqvist/Reticulum/blob/master/LICENSE · history: https://reticulum.network/manual/brandolinis.html
- [S39] NTC MC 03-05-2007 (SRD): https://region7.ntc.gov.ph/wp-content/uploads/2024/01/mc_03_05_2007.pdf · NTC WDN index: https://region7.ntc.gov.ph/laws-rules-and-regulations/memorandum-circulars/wireless-data-network-services/
- [S40] Philippine Meshtastic field test (Seeed): https://www.seeedstudio.com/blog/2025/07/03/empowering-disaster-resilience-in-the-philippines-with-sensecap-t1000-e-meshtastic-solutions/
- [S41] Vendor prices: https://heltec.org/shop-default/ · https://store.rakwireless.com/products/wisblock-meshtastic-starter-kit · https://lilygo.cc/products/t-echo-lilygo

**Wi-Fi standards and studies**
- [S42] Wi-Fi Alliance: Wi-Fi Direct range FAQ: https://www.wi-fi.org/knowledge-center/faq/does-the-specification-underlying-the-wi-fi-direct-certification-program-work · Wi-Fi Aware FAQ: https://www.wi-fi.org/knowledge-center/faq/how-do-users-experience-wi-fi-aware
- [S43] Android Wi-Fi Direct group sizes study: https://ar5iv.labs.arxiv.org/html/2307.03126
- [S44] Wi-Fi Direct spec v1.9: https://www.wi-fi.org/system/files/Wi-Fi_Direct_Specification_v1.9.pdf

**BLE issues and capabilities**
- [S45] BLE chunking (ble-plx #84): https://github.com/dotintent/react-native-ble-plx/issues/84 · GATT 133 (ble-manager #193): https://github.com/innoveit/react-native-ble-manager/issues/193
- [S51] Coded PHY support: https://source.android.com/docs/core/connect/bluetooth/ble_advertising · https://docs.silabs.com/bluetooth/6.2.0/bluetooth-mobile-applications/finding-smartphone-features

**Metadata and platform**
- [S46] Metadata: GitHub REST API (`api.github.com/repos/...`), ungh.cc mirror, npm registry (`registry.npmjs.org`), npm downloads API. All fetched 2026-10-09.
- [S47] RN New Architecture default (0.76): https://reactnative.dev/blog/2024/10/23/the-new-architecture-is-here
