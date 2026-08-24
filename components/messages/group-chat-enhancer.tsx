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

    function escapeText(value: string) {
      return value.replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[character] ?? character));
    }

    function escapeAttribute(value: string) {
      return escapeText(value).replace(/'/g, "&#39;");
    }

    async function showInfo() {
      const items = await conversations();
      const conversation = items.find((item: any) => item.id === conversationId);
      if (!conversation) return;
      close();
      panel = document.createElement("div");
      panel.className = "fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm";
      const members = conversation.otherUsers ?? [];
      panel.innerHTML = `<div class="w-full max-w-md rounded-3xl border border-border bg-surface p-5 shadow-2xl"><div class="flex items-center justify-between"><div><p class="text-xs uppercase tracking-[0.2em] text-accent">Group chat</p><h3 class="mt-1 text-xl font-semibold text-white">${escapeText(conversation.name ?? "Group Chat")}</h3></div><button data-close class="rounded-xl px-3 py-2 text-sm text-muted hover:bg-white/5 hover:text-white">Close</button></div><div class="mt-5 space-y-2">${members.map((member: any) => `<div class="flex items-center gap-3 rounded-2xl border border-border bg-background/40 p-2.5"><img src="${escapeAttribute(member.avatar ?? "")}\" class="h-9 w-9 rounded-full object-cover" /><div class="min-w-0 flex-1"><p class="truncate text-sm font-semibold text-white">${escapeText(member.displayName ?? member.username)}</p><p class="truncate text-xs text-muted">@${escapeText(member.profileHandle ?? member.username)}</p></div>${member.id === conversation.createdById ? `<span class="text-xs text-accent">Owner</span>` : `<button data-remove="${escapeAttribute(member.id)}" class="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-400/10">Remove</button>`}</div>`).join("")}</div></div>`;
      document.body.appendChild(panel);
      panel.querySelector("[data-close]")?.addEventListener("click", close);
      panel.addEventListener("click", async (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-remove]");
        if (!button || !conversationId || !confirm("Remove this user from the group?")) return;
        const response = await fetch(`/api/messages/conversations/${conversationId}/members/${button.dataset.remove}`, { method: "DELETE" });
        if (response.ok) await showInfo();
      });
    }

    async function showCreateGroup() {
      const response = await fetch("/api/friends", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      const friends = data.friends ?? [];
      close();
      panel = document.createElement("div");
      panel.className = "fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm";
      const friendOptions = friends.length
        ? friends.map((friend: any) => `<label class="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-background/40 p-3 transition hover:bg-white/5"><input type="checkbox" data-friend-id="${escapeAttribute(friend.id)}" class="h-4 w-4 accent-[var(--accent)]" /><img src="${escapeAttribute(friend.avatar ?? "")}" class="h-9 w-9 rounded-full object-cover" /><span class="min-w-0 flex-1"><span class="block truncate text-sm font-semibold text-white">${escapeText(friend.displayName ?? friend.username)}</span><span class="block truncate text-xs text-muted">@${escapeText(friend.profileHandle ?? friend.username)}</span></span></label>`).join("")
        : `<p class="rounded-2xl border border-dashed border-border p-5 text-center text-sm text-muted">You need at least one friend to create a group chat.</p>`;
      panel.innerHTML = `<form data-create-group class="w-full max-w-lg rounded-3xl border border-border bg-surface p-5 shadow-2xl"><div class="flex items-start justify-between gap-4"><div><p class="text-xs uppercase tracking-[0.2em] text-accent">New group chat</p><h3 class="mt-1 text-xl font-semibold text-white">Choose friends</h3><p class="mt-2 text-sm text-muted">Select multiple friends to add to the group.</p></div><button type="button" data-close class="rounded-xl px-3 py-2 text-sm text-muted hover:bg-white/5 hover:text-white">Close</button></div><label class="mt-5 block text-sm text-muted">Group name <span class="text-xs">(optional)</span><input data-group-name maxlength="60" placeholder="Group Chat" class="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-white outline-none focus:border-accent" /></label><div class="mt-4 max-h-80 space-y-2 overflow-y-auto">${friendOptions}</div><p data-group-error class="mt-3 hidden rounded-xl border border-red-400/30 bg-red-400/10 px-3 py-2 text-sm text-red-200"></p><button type="submit" data-create-submit ${friends.length ? "" : "disabled"} class="mt-4 w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent/80 disabled:cursor-not-allowed disabled:opacity-50">Create group chat</button></form>`;
      document.body.appendChild(panel);
      panel.querySelector("[data-close]")?.addEventListener("click", close);
      panel.querySelector("[data-create-group]")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.currentTarget as HTMLFormElement;
        const ids = Array.from(form.querySelectorAll<HTMLInputElement>("[data-friend-id]:checked")).map((input) => input.dataset.friendId).filter((id): id is string => Boolean(id));
        const error = form.querySelector<HTMLElement>("[data-group-error]");
        const submit = form.querySelector<HTMLButtonElement>("[data-create-submit]");
        if (ids.length === 0) {
          if (error) { error.textContent = "Select at least one friend."; error.classList.remove("hidden"); }
          return;
        }
        submit?.setAttribute("disabled", "true");
        if (error) error.classList.add("hidden");
        try {
          const name = form.querySelector<HTMLInputElement>("[data-group-name]")?.value.trim() ?? "";
          const createResponse = await fetch("/api/messages/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "group", name, memberIds: ids }) });
          const result = await createResponse.json().catch(() => ({}));
          if (!createResponse.ok) throw new Error(result.error ?? "Could not create the group chat.");
          close();
          window.location.reload();
        } catch (createError) {
          if (error) { error.textContent = createError instanceof Error ? createError.message : "Could not create the group chat."; error.classList.remove("hidden"); }
          submit?.removeAttribute("disabled");
        }
      });
    }

    async function enhance() {
      const items = await conversations();
      const groupHeader = Array.from(document.querySelectorAll("header")).find((item) => /\d+ members/.test(item.textContent ?? ""));
      if (groupHeader) {
        const title = groupHeader.querySelector("h2")?.textContent?.trim() ?? "";
        const conversation = items.find((item: any) => item.type === "group" && item.name === title);
        if (conversation) {
          conversationId = conversation.id;
          const existing = groupHeader.querySelector("[data-group-controls]");
          if (!existing) {
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
            groupHeader.appendChild(controls);
          }
        }
      }

      const chatsLabel = Array.from(document.querySelectorAll("p")).find((item) => item.textContent?.trim() === "Chats");
      const chatsBar = chatsLabel?.parentElement;
      if (!chatsBar || chatsBar.querySelector("[data-new-group-chat]") || !chatsBar.querySelector("button")) return;
      const groupButton = document.createElement("button");
      groupButton.type = "button";
      groupButton.dataset.newGroupChat = "true";
      groupButton.className = "rounded-lg p-1.5 text-muted hover:bg-white/5 hover:text-white";
      groupButton.title = "New group chat";
      groupButton.setAttribute("aria-label", "New group chat");
      groupButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>`;
      groupButton.addEventListener("click", () => void showCreateGroup());
      chatsBar.insertBefore(groupButton, chatsBar.querySelector("button"));
    }

    const observer = new MutationObserver(() => void enhance());
    observer.observe(document.body, { childList: true, subtree: true });
    const timer = window.setInterval(() => void enhance(), 3000);
    void enhance();
    return () => { observer.disconnect(); window.clearInterval(timer); close(); };
  }, []);

  return null;
}
