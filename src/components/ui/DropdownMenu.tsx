"use client";

import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const DropdownMenu = RadixMenu.Root;
export const DropdownMenuTrigger = RadixMenu.Trigger;

export function DropdownMenuContent({
  children,
  align = "end",
}: {
  children: ReactNode;
  align?: "start" | "end" | "center";
}) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content
        align={align}
        sideOffset={6}
        className="glass z-50 min-w-40 rounded-xl p-1.5 focus:outline-none"
      >
        {children}
      </RadixMenu.Content>
    </RadixMenu.Portal>
  );
}

export function DropdownMenuItem({
  children,
  onSelect,
  destructive,
}: {
  children: ReactNode;
  onSelect?: () => void;
  destructive?: boolean;
}) {
  return (
    <RadixMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none",
        "text-ink-muted transition-colors hover:bg-[var(--glass-surface-hover)] hover:text-ink",
        "data-[highlighted]:bg-[var(--glass-surface-hover)] data-[highlighted]:text-ink",
        destructive && "text-danger hover:text-danger data-[highlighted]:text-danger"
      )}
    >
      {children}
    </RadixMenu.Item>
  );
}
