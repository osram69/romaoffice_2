import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ServiceCode } from "./pricing";

// The two services have different original request forms, both living in public/ as-is.
export function requestModuleFilename(service: ServiceCode) {
  return service === "postal" ? "Modulo_Richiesta_DomiciliazionePostale.pdf" : "Modulo_Richiesta_Domiciliazione_ns.pdf";
}

// Lets the download button disappear instead of linking to a missing file (which the catch-all
// redirect would turn into a saved copy of the home page).
export function requestModuleAvailable(service: ServiceCode) {
  return existsSync(join(process.cwd(), "public", requestModuleFilename(service)));
}
