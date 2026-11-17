"use client";

import { useSyncExternalStore } from "react";

/**
 * Email and phone, kept out of the HTML and the JS bundles so address
 * scrapers find neither. Each value is stored as reversed fragments (no
 * "@", no "mailto:", no real digit run) and only assembled in the browser
 * after hydration; the server render gets null, and callers show a
 * neutral placeholder until then. scripts/verify/contact-points.mjs
 * checks the built HTML and chunks never contain the plain values.
 */
const EMAIL_USER = ["nores", "najraham", "5"];
const EMAIL_HOST = ["liamg", "moc"];
const PHONE_CC = "779"; // country code
const PHONE_LOCAL = ["33289", "40927"];

const rev = (s: string) => s.split("").reverse().join("");

function assemble() {
  const user = EMAIL_USER.map(rev).join(".");
  const email = `${user}${String.fromCharCode(64)}${EMAIL_HOST.map(rev).join(".")}`;
  const local = PHONE_LOCAL.map(rev).join("");
  const cc = rev(PHONE_CC);
  return {
    email,
    mailHref: `${["mai", "lto"].join("")}:${email}`,
    /** As printed: country code, a space, then the 10-digit local number. */
    phone: `+${cc} ${local}`,
    phoneHref: `tel:+${cc}${local}`,
  };
}

export type ContactPoints = ReturnType<typeof assemble>;

let cached: ContactPoints | null = null;
const getClient = () => (cached ??= assemble());
const getServer = () => null;
const subscribe = () => () => {};

/** null during the server render and hydration; the values afterwards. */
export function useContactPoints(): ContactPoints | null {
  return useSyncExternalStore(subscribe, getClient, getServer);
}
