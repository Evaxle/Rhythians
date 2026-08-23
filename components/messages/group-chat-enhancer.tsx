"use client";

import { useEffect } from "react";

export function GroupChatEnhancer() {
  useEffect(() => {
    let panel: HTMLDivElement | null = null;
    let conversationId = "";

    async function conversations() {
      const response = await fetch("/api/messages/conversations", { cache: "no-store" });
      if (!response.ok) return [];
      const data = await response.json();
      return data.conversations ?? [];
    }

    function close() {
      panel?.remove();
      panel = null;
    }

    async function showInfo() {
      const items = await conversations();
      const conversation = items.find((item: any) => item.id === conversationId);
      if (!conversation) return;
      close();
      panel = document.createElement("div");
      panel.className = "fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm";
      const members = conversation.otherUsers ?? [];
      panel.innerHTML = `<div class="w-full max-w-md rounded-3xl border border-border bg-surface p-5 shadow-2xl"><div class="flex items-center justify-between"><div><p class="text-xs uppercase tracking-[0.2em] text-accent">Group chat</p><h3 class="mt-1 text-xl font-semibold text-white">${escapeText(conversation.name ?? "Group Chat")}</h3></div><button data-close class="rounded-xl px-3 py-2 text-sm text-muted hover:bg-white/5 hover:text-white">Close</button></div><div class="mt-5 space-y-2">${members.map((member: any) => `<div class="flex items-center gap-3 rounded-2xl border border-border bg-background/40 p-2.5"><img src="${escapeAttribute(member.avatar ?? "")}" class="h-9 w-9 rounded-full object-cover" /><div class="min-w-0 flex-1"><p class="truncate text-sm font-semibold text-white">${escapeText(member.displayName ?? member.username)}</p><p class="truncate text-xs text-muted">@${escapeText(member.profileHandle ?? member.username)}</p></div>${member.id === conversation.createdById ? `<span class="text-xs text-accent">Owner</span>` : `<button data-remove="${escapeAttribute(member.id)}" class="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-400/10">Remove</button>`}</div>`).join("")}</div></div>`;
      document.body.appendChild(panel);
      panel.querySelector("[data-close]")?.addEventListener("click", close);
      panel.addEventListener("click", async (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-remove]");
        if (!button || !conversationId || !confirm("Remove this user from the group?")) return;
        const response = await fetch(`/api/messages/conversations/${conversationId}/members/${button.dataset.remove}`, { method: "DELETE" });
        if (response.ok) await showInfo();
      });
    }

    function escapeText(value: string) {
      return value.replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[character] ?? character));
    }

    function escapeAttribute(value: string) {
      return escapeText(value).replace(/'/g, "&#39;");
    }

    async function enhance() {
      const items = await conversations();
      const header = Array.from(document.querySelectorAll("header")).find((item) => /\d+ members/.test(item.textContent ?? ""));
      if (!header) return;
      const title = header.querySelector("h2")?.textContent?.trim() ?? "";
      const conversation = items.find((item: any) => item.type === "group" && item.name === title);
      if (!conversation) return;
      conversationId = conversation.id;
      const existing = header.querySelector("[data-group-controls]");
      if (existing) return;
      const controls = document.createElement("div");
      controls.dataset.groupControls = "true";
      controls.className = "ml-auto flex items-center gap-2";
      const avatars = document.createElement("div");
      avatars.className = "flex -space-x-2";
      (conversation.otherUsers ?? []).slice(0, 4).forEach((member: any) => {
        const image = document.createElement("img");
        image.src = member.avatar ?? "";
        image.alt = member.username ?? "";
        image.className = "h-7 w-7 rounded-full border-2 border-surface object-cover";
        avatars.appendChild(image);
      });
      const info = document.createElement("button");
      info.className = "rounded-xl p-2 text-muted hover:bg-white/5 hover:text-white";
      info.textContent = "ⓘ";
      info.title = "Group members";
      info.addEventListener("click", () => void showInfo());
      controls.append(avatars, info);
      header.appendChild(controls);
    }

    const observer = new MutationObserver(() => void enhance());
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(() => void enhance(), 3000);
    void enhance();
    return () => { observer.disconnect(); window.clearInterval(timer); close(); };
  }, []);

  return null;
}
