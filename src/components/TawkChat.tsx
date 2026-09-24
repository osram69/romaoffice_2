"use client";
import { useEffect } from "react";

// Property/widget id confirmed by the client as the one actually used on the live
// romaofficesharing.it site (the template also carried a second, stale snippet).
const TAWKTO_PROPERTY_ID = "61239d14d6e7610a49b18c6f";
const TAWKTO_WIDGET_ID = "1fdphr6r3";

export function TawkChat() {
  useEffect(() => {
    if (document.getElementById("tawkto-script")) return;
    const script = document.createElement("script");
    script.id = "tawkto-script"; script.async = true;
    script.src = `https://embed.tawk.to/${TAWKTO_PROPERTY_ID}/${TAWKTO_WIDGET_ID}`;
    script.charset = "UTF-8"; script.setAttribute("crossorigin", "*");
    document.head.appendChild(script);
  }, []);
  return null;
}
