"use client";

import { useEffect, useState } from "react";

const DB_NAME = "rhythians-preferences";
const STORE_NAME = "settings";
const KEY = "mobile-confirmation";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readConfirmation() {
  const db = await openDatabase();
  return new Promise<boolean | null>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(KEY);
    request.onsuccess = () => resolve(request.result === true ? true : request.result === false ? false : null);
    request.onerror = () => reject(request.error);
  });
}

async function saveConfirmation(value: boolean) {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(value, KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function isMobileDevice() {
  return window.matchMedia("(max-width: 699px)").matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function MobileRedirect() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (window.location.pathname.startsWith("/mobile")) return;
    if (!isMobileDevice()) return;
    readConfirmation().then((value) => {
      if (value === true) window.location.assign(`/mobile${window.location.pathname}${window.location.search}${window.location.hash}`);
      else if (value === null) setOpen(true);
    }).catch(() => setOpen(true));
  }, []);

  if (!open) return null;

  const continueTo = async (mobile: boolean) => {
    setBusy(true);
    try {
      await saveConfirmation(mobile);
      if (mobile) window.location.assign(`/mobile${window.location.pathname}${window.location.search}${window.location.hash}`);
      else setOpen(false);
    } catch {
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 p-4 backdrop-blur-md"><div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101629] p-6 shadow-2xl"><div className="mb-5"><p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Rhythians</p><h2 className="mt-2 text-2xl font-bold text-white">Use the mobile version?</h2><p className="mt-2 text-sm leading-6 text-muted">It looks like you are using a phone. Would you like to open the mobile app-style version of Rhythians?</p></div><div className="grid gap-2"><button disabled={busy} onClick={() => continueTo(true)} className="rounded-2xl bg-accent px-4 py-3 text-sm font-bold text-white">Yes, use mobile</button><button disabled={busy} onClick={() => continueTo(false)} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white">No, keep the regular site</button></div></div></div>;
}
